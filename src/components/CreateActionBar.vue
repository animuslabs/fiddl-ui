<template lang="pug">
.centered.relative-position(:class="{'is-mobile': isMobile}" )
  //- div(style="overflow:hidden;")
    h1.create-title.text-grey-5(aria-hidden="true" v-if="!isMobile") Create
  .centered.q-mb-md.q-mt-sm
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
        )
          div(style="width:10px;")
        q-btn(
          no-caps
          rounded
          color="black"
          :loading="privateLoading"
          :disable="isDisabled"
          @click="handleClick(false)"
        )
          div(style="width:10px;")
          q-icon.q-mr-sm(name="visibility_off")
          span Private
          .badge {{ privateCost }}
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
  cooldown.value = true
  setTimeout(() => (cooldown.value = false), 2000)
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
</style>
