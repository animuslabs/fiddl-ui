<template lang="pug">
q-dialog(v-model="open" persistent :maximized="$q.screen.lt.md")
  q-card(ref="cardRef" :class="['survey-card', { 'full-mobile': $q.screen.lt.md }]")
    // Scrollable content
    .content-scroll(ref="contentRef")
      // Sticky header
      .header-sticky.q-px-lg.q-pt-lg.q-pb-sm
        .row.no-wrap.items-center.q-gutter-md
          q-icon(name="campaign" color="primary" size="lg")
          .col
            .text-h6.q-mb-none How did you hear about Fiddl.art?
            .text-body2.text-grey-5.q-mt-xs Help us improve by selecting one option.
      // Grid of options
      .row.q-col-gutter-sm.q-px-lg.q-pt-md.q-mt-md
        .col-6.col-sm-4(v-for="opt in options" :key="opt.value")
          q-card(
            class="opt-tile"
            :class="{ selected: choice === opt.value, disabled: submitting }"
            clickable
            @click="!submitting && (choice = opt.value)"
          )
            .row.items-center.q-gutter-sm.q-pa-md
              q-icon(:name="opt.icon" color="primary" size="md")
              .text-body1 {{ opt.label }}

      // Other text input
      q-input(
        v-if="choice === 'other'"
        v-model="otherText"
        label="Please specify"
        autogrow
        dense
        :autofocus="isMobile && choice === 'other'"
        :maxlength="200"
        counter
        class="q-mt-md q-px-lg"
        ref="otherInputRef"
        @keyup.enter="submit"
      )

      // Bottom spacer so sticky footer doesn't overlap content
      .bottom-spacer

    // Sticky footer
    .footer.q-pa-md
      .row.items-center.justify-end
        q-btn(
          v-if="choice === 'other'"
          color="primary"
          unelevated
          label="Submit"
          :disable="!canSubmit || submitting"
          :loading="submitting"
          @click="submit"
        )
</template>

<script lang="ts" setup>
import { computed, ref, watch, nextTick } from "vue"
import { LocalStorage, useQuasar } from "quasar"

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    userId?: string | null
  }>(),
  {
    modelValue: false,
    userId: null,
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void
  (e: "submitted", payload: { choice: string; otherText?: string }): void
}>()

const $q = useQuasar()
const open = ref<boolean>(props.modelValue)
const choice = ref<string>("")
const otherText = ref<string>("")
const isMobile = $q.platform.is.mobile === true

watch(
  () => props.modelValue,
  (v) => (open.value = v),
)
watch(open, (v) => emit("update:modelValue", v))

type HowFoundValue = "reddit" | "facebook" | "instagram" | "tiktok" | "twitter" | "youtube" | "search" | "friend" | "blog" | "discord" | "newsletter" | "other"
const options: Array<{ label: string; value: HowFoundValue; icon: string }> = [
  { label: "Reddit", value: "reddit", icon: "fa-brands fa-reddit" },
  { label: "Facebook", value: "facebook", icon: "fa-brands fa-facebook" },
  { label: "Instagram", value: "instagram", icon: "fa-brands fa-instagram" },
  { label: "TikTok", value: "tiktok", icon: "fa-brands fa-tiktok" },
  { label: "Twitter / X", value: "twitter", icon: "fa-brands fa-x-twitter" },
  { label: "YouTube", value: "youtube", icon: "fa-brands fa-youtube" },
  { label: "Search", value: "search", icon: "fa-brands fa-google" },
  { label: "Friend", value: "friend", icon: "group" },
  { label: "Discord", value: "discord", icon: "fa-brands fa-discord" },
  { label: "Article", value: "blog", icon: "article" },
  { label: "Newsletter", value: "newsletter", icon: "mail" },
  { label: "Other", value: "other", icon: "more_horiz" },
]

const canSubmit = computed(() => {
  if (!choice.value) return false
  if (choice.value === "other") return otherText.value.trim().length > 0
  return true
})

import { marketingSetHowFound } from "lib/orval"

const cardRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const otherInputRef = ref<any>(null)
const submitting = ref(false)

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  const payload = { choice: choice.value, otherText: choice.value === "other" ? otherText.value.trim() : undefined }
  try {
    // Conform to API shape
    await marketingSetHowFound({ source: payload.choice as any, otherText: payload.otherText })
    const uid = props.userId || "anon"
    LocalStorage.set(`referralSurveyCompleted:${uid}`, true)
    LocalStorage.set(`referralSurveyAnswer:${uid}`, payload)
    emit("submitted", payload)
    $q.notify({ message: "Thanks for the feedback!", color: "positive", timeout: 1500 })
    open.value = false
  } catch (e) {
    $q.notify({ message: "Failed to submit. Please try again.", color: "negative" })
  } finally {
    submitting.value = false
  }
}

// When selecting "other", scroll input into view and focus it
watch(choice, (val) => {
  if (val === "other") {
    nextTick(() => {
      try {
        // Focus immediately; some mobile browsers need retries to open keyboard
        otherInputRef.value?.focus?.()
      } catch {}
      try {
        const container = contentRef.value
        const el: HTMLElement | null = otherInputRef.value?.$el || null
        if (container && el) {
          const top = Math.max(0, el.offsetTop - 24)
          container.scrollTo({ top, behavior: "smooth" })
        }
      } catch {}
      if (isMobile) {
        // Nudge focus again after layout settles to trigger soft keyboard
        setTimeout(() => {
          try {
            otherInputRef.value?.focus?.()
          } catch {}
        }, 80)
        setTimeout(() => {
          try {
            otherInputRef.value?.focus?.()
          } catch {}
        }, 300)
      }
    })
  } else if (val) {
    // Auto-submit immediately for any non-"other" selection
    nextTick(() => {
      void submit()
    })
  }
})
</script>

<style scoped lang="sass">
.survey-card
  min-width: 320px
  max-width: 560px
  max-height: 80vh
  display: flex
  flex-direction: column

.content-scroll
  flex: 1
  overflow: auto

.header-sticky
  position: sticky
  top: 0
  z-index: 1
  /* Soft gradient to avoid harsh black bar */
  background: linear-gradient(to bottom, rgba(18,18,18,0.95), rgba(18,18,18,0.75), rgba(18,18,18,0))
  backdrop-filter: blur(6px)
  /* Respect safe areas on mobile */
  padding-top: max(0px, env(safe-area-inset-top))
  border-bottom: 1px solid rgba(255,255,255,0.06)
  box-shadow: 0 6px 16px rgba(0,0,0,0.2)

.opt-tile
  border: 1px solid rgba(255,255,255,0.08)
  transition: border-color .15s ease, background-color .15s ease
  cursor: pointer
  &:hover
    border-color: rgba(255,255,255,0.2)
  &.selected
    border-color: var(--q-primary)
    background-color: rgba(56, 189, 248, 0.06)
  &.disabled
    pointer-events: none
    opacity: 0.7

.bottom-spacer
  height: 64px

.footer
  position: sticky
  bottom: 0
  /* Gradient fades upward to avoid a hard bar */
  background: linear-gradient(to top, rgba(18,18,18,0.95), rgba(18,18,18,0.7), rgba(18,18,18,0))
  backdrop-filter: blur(8px)
  border-top: 1px solid rgba(255,255,255,0.06)
  /* Extra breathing room below the button */
  padding-bottom: calc(max(12px, env(safe-area-inset-bottom)) + 8px)
  box-shadow: 0 -6px 16px rgba(0,0,0,0.2)

// Fullscreen adjustments when dialog is maximized
:deep(.q-dialog__inner--maximized)
  padding: 0 !important

:deep(.q-dialog__inner--maximized) .survey-card
  width: 100%
  height: 100dvh
  height: 100vh
  max-width: none
  max-height: none
  border-radius: 0

// Force full-height on mobile when we bind the class
.full-mobile
  width: 100% !important
  height: 100dvh !important
  height: 100vh !important
  max-width: none !important
  max-height: none !important
  border-radius: 0 !important
</style>
