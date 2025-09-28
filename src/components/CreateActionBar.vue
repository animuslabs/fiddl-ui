<template lang="pug">
.centered.relative-position(:class="{'is-mobile': isMobile}" )
  //- div(style="overflow:hidden;")
    h1.create-title.text-grey-5(aria-hidden="true" v-if="!isMobile") Create
  q-separator(color="grey-8").full-width
  .centered.q-mb-md.q-mt-xs
    h5 Create
  .toolbar.centered.full-width
    .relative-position
      q-btn-group(rounded).relative-position
        template(v-if="showMobileBack")
          q-btn(
            no-caps
            label="< Back"
            color="accent"
            outline
            @click="$emit('back')"

          )
        q-btn(
          no-caps
          icon="public"
          color="primary"
          label="Public"
          :loading="publicLoading"
          :disable="isDisabled"
          @click="handleClick(true)"
        ).relative-position
          // pop counter for public button (single)
          .queue-popups
            transition(name="popfade")
              .queue-pop.bg-primary(v-if="publicPopup" :key="publicPopupKey") {{ publicPopup.text }}
          div(style="width:10px;")
        q-btn(
          no-caps
          rounded
          color="black"
          :loading="privateLoading"
          :disable="isDisabled"
          @click="handleClick(false)"
        ).relative-position
          div(style="width:10px;")
          q-icon.q-mr-sm(name="visibility_off")
          span Private
          .badge {{ privateCost }}
          // pop counter for private button (single)
          .queue-popups
            transition(name="popfade")
              .queue-pop.bg-black(v-if="privatePopup" :key="privatePopupKey") {{ privatePopup.text }}
      .badge(v-if="isMobile" style="right:37%;") {{ publicCost }}
      .badge(v-else style="right:49%;") {{ publicCost }}
  div.text-caption.text-grey-4.text-center.caption.q-mt-sm {{ caption }}
</template>

<script lang="ts" setup>
import { computed, ref } from "vue"
import { useQuasar } from "quasar"

const props = withDefaults(
  defineProps<{
    publicCost: number
    privateCost: number
    disabled?: boolean
    loadingCreate?: boolean
    currentPublic?: boolean
    caption?: string
    showBackBtn?: boolean
    onCreate?: (isPublic: boolean) => boolean | Promise<boolean>
    kind?: "image" | "video" | "media"
    extraDisabled?: boolean
  }>(),
  {
    disabled: false,
    loadingCreate: false,
    currentPublic: true,
    caption: "Public creations appear in the community feed.",
    showBackBtn: false,
    kind: "media",
    extraDisabled: false,
  },
)

const $q = useQuasar()
const cooldown = ref(false)
const lastClickedPublic = ref<boolean | null>(null)
const isDisabled = computed(() => props.disabled || cooldown.value || !!props.extraDisabled)
const isMobile = computed(() => $q.screen.lt.md)
const showMobileBack = computed(() => props.showBackBtn && isMobile.value)
const publicLoading = computed(() => (props.loadingCreate && !!props.currentPublic) || (cooldown.value && lastClickedPublic.value === true))
const privateLoading = computed(() => (props.loadingCreate && !props.currentPublic) || (cooldown.value && lastClickedPublic.value === false))

// quick burst counter and single popups
type Popup = { text: string }
const publicPopup = ref<Popup | null>(null)
const privatePopup = ref<Popup | null>(null)
const burstCount = ref(0)
let burstResetTimer: ReturnType<typeof setTimeout> | null = null
let publicHideTimer: ReturnType<typeof setTimeout> | null = null
let privateHideTimer: ReturnType<typeof setTimeout> | null = null
const publicPopupKey = ref(0)
const privatePopupKey = ref(0)

async function handleClick(isPublic: boolean) {
  if (isDisabled.value) return
  let started = true
  if (props.onCreate) {
    try {
      const res = await props.onCreate(isPublic)
      started = !!res
    } catch {
      started = false
    }
  }
  if (!started) return
  lastClickedPublic.value = isPublic
  const cost = isPublic ? props.publicCost : props.privateCost
  $q.notify({ color: "positive", message: `Starting ${props.kind || "media"} creation${isPublic ? " (Public)" : " (Private)"} · ${cost} points` })
  // super short cooldown to allow rapid queueing
  cooldown.value = true
  setTimeout(() => (cooldown.value = false), 100)

  // increment burst counter and show single popup over the clicked button
  burstCount.value += 1
  const entry: Popup = { text: `+${burstCount.value}` }
  if (isPublic) {
    if (publicHideTimer) clearTimeout(publicHideTimer)
    publicPopup.value = entry
    publicPopupKey.value += 1 // force re-enter animation
    publicHideTimer = setTimeout(() => {
      publicPopup.value = null
    }, 2200)
  } else {
    if (privateHideTimer) clearTimeout(privateHideTimer)
    privatePopup.value = entry
    privatePopupKey.value += 1 // force re-enter animation
    privateHideTimer = setTimeout(() => {
      privatePopup.value = null
    }, 2200)
  }
  // reset burst count if no clicks for a short while
  if (burstResetTimer) clearTimeout(burstResetTimer)
  burstResetTimer = setTimeout(() => {
    burstCount.value = 0
  }, 1800)
}

defineEmits(["back"])
</script>

<style scoped>
.create-action-bar {
  min-height: 110px;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.toolbar {
  width: 100%;
  max-width: 520px;
  justify-content: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.create-action-bar.is-mobile .toolbar {
  justify-content: center;
  padding: 0 8px;
}

.back-btn {
  min-width: 92px;
}

.controls {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 2;
}

.create-action-bar.is-mobile .controls {
  justify-content: flex-end;
}

.create-title {
  font-size: 125px;
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  opacity: 0.08;
  z-index: 1;
}

.create-action-bar.is-mobile .create-title {
  font-size: 90px;
}

.caption {
  width: 100%;
  z-index: 2;
}

.create-action-bar.is-mobile .caption {
  text-align: center;
  padding: 0 12px;
}

.create-mode-group {
  padding: 4px;
}
.create-mode-group .create-mode-btn {
  min-width: 130px;
  color: #fdfdfd;
  gap: 8px;
  position: relative;
}
.create-mode-group .create-mode-btn span {
  font-weight: 600;
}
.create-mode-group .create-mode-btn:hover,
.create-mode-group .create-mode-btn:focus {
  background: rgba(255, 255, 255, 0.2);
}
.create-mode-group .create-mode-btn.q-btn--actionable:active {
  background: rgba(255, 255, 255, 0.28);
}

.create-mode-group .create-mode-btn .badge {
  top: -16px;
  right: -16px;
}

.create-mode-group .create-mode-btn--public .badge {
  left: -16px;
  right: auto;
}

/* Queue popups above buttons */
.queue-popups {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -100%);
  pointer-events: none;
  z-index: 5;
}
.queue-pop {
  color: #fff;
  font-size: 14px;
  line-height: 1;
  padding: 6px 8px;
  margin-top: 6px;
  border-radius: 10px;
  display: inline-block;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

/* transition-group animations */
.popfade-enter-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.popfade-leave-active { transition: none !important; }
.popfade-enter-from { opacity: 0; transform: translateY(8px); }
.popfade-enter-to { opacity: 1; transform: translateY(0); }
.popfade-leave-from { opacity: 1; }
.popfade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
