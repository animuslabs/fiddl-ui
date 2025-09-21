<template lang="pug">
q-form(@submit.prevent="handleSubmit")
  .row.no-wrap.items-center
    .col-grow
      q-input(
        ref="inputRef"
        :model-value="modelValue"
        type="textarea"
        autogrow
        filled
        :disable="submitting"
        :maxlength="500"
        counter
        :placeholder="placeholder"
        hint="Mentions supported with @username."
        @update:model-value="onInputUpdate"
        @keydown="onInputKeydown"
      )
        template(#control="{ id, field, modelValue: innerValue, emitValue }")
          div.media-mention-control
            div.media-mention-overlay
              template(v-if="mentionPreviewSegments.length")
                span.media-mention-overlay-segment(
                  v-for="(segment, index) in mentionPreviewSegments"
                  :key="index"
                  :class="segmentClass(segment)"
                ) {{ segmentDisplayText(segment) }}
              span.media-mention-overlay-placeholder(v-else) {{ placeholder }}
            textarea.media-mention-textarea(
              ref="textareaRef"
              v-bind="field"
              :id="id"
              :value="innerValue"
              @input="onTextareaInput($event, emitValue)"
              @keydown="onTextareaKeydown"
            )
    .col-auto
      q-btn(
        color="primary"
        flat
        size="md"
        icon="send"
        type="submit"
        :loading="submitting"
        :disable="submitDisabled"
      )
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue"
import { QInput } from "quasar"
import { userFindByUsername } from "src/lib/orval"
import { useUserAuth } from "src/stores/userAuth"
import {
  buildSegments,
  extractMentionHandles,
  segmentClass,
  type CommentSegment,
  type MentionStatus,
} from "./commentUtils"

interface Props {
  modelValue: string
  submitting: boolean
  submitDisabled: boolean
  placeholder: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "submit"): void
}>()

const inputRef = ref<InstanceType<typeof QInput> | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const userAuth = useUserAuth()
const mentionStatuses = reactive<Record<string, MentionStatus>>({})
const mentionStatusVersion = ref(0)
const mentionTimers = new Map<string, number>()
const activeMentions = ref<string[]>([])
const hasWindow = typeof window !== "undefined"

const placeholder = computed(() => props.placeholder || "Leave a comment")

const mentionPreviewSegments = computed<CommentSegment[]>(() => {
  void mentionStatusVersion.value
  return buildSegments(props.modelValue, (handle) => ({
    status: mentionStatuses[handle] ?? null,
    username: handle,
  }))
})

watch(
  () => props.modelValue,
  (value) => {
    updateMentionTracking(value)
  },
  { immediate: true },
)

watch(
  () => userAuth.loggedIn,
  () => {
    updateMentionTracking(props.modelValue)
  },
)

function setMentionStatus(handle: string, status: MentionStatus) {
  if (mentionStatuses[handle] === status) return
  mentionStatuses[handle] = status
  bumpMentionStatusVersion()
}

function removeMentionStatus(handle: string) {
  if (!mentionStatuses[handle]) return
  delete mentionStatuses[handle]
  bumpMentionStatusVersion()
}

function clearMentionStatuses() {
  if (!Object.keys(mentionStatuses).length) return
  Object.keys(mentionStatuses).forEach((key) => {
    delete mentionStatuses[key]
  })
  bumpMentionStatusVersion()
}

function bumpMentionStatusVersion() {
  mentionStatusVersion.value += 1
}

function resetMentionState() {
  activeMentions.value = []
  mentionTimers.forEach((timer) => {
    if (hasWindow) window.clearTimeout(timer)
  })
  mentionTimers.clear()
  clearMentionStatuses()
}

function updateMentionTracking(text: string) {
  if (!userAuth.loggedIn) {
    resetMentionState()
    return
  }

  const handles = extractMentionHandles(text)
  activeMentions.value = handles
  const handleSet = new Set(handles)

  for (const key of Object.keys(mentionStatuses)) {
    if (!handleSet.has(key)) {
      removeMentionStatus(key)
      const timer = mentionTimers.get(key)
      if (timer) {
        if (hasWindow) window.clearTimeout(timer)
        mentionTimers.delete(key)
      }
    }
  }

  for (const handle of handles) {
    if (mentionStatuses[handle]) continue
    setMentionStatus(handle, "loading")
    scheduleMentionValidation(handle)
  }
}

function scheduleMentionValidation(handle: string) {
  const existing = mentionTimers.get(handle)
  if (existing && hasWindow) window.clearTimeout(existing)
  if (!hasWindow) {
    void validateMention(handle)
    return
  }
  const timer = window.setTimeout(() => {
    mentionTimers.delete(handle)
    void validateMention(handle)
  }, 300)
  mentionTimers.set(handle, timer)
}

async function validateMention(handle: string) {
  if (!userAuth.loggedIn) {
    setMentionStatus(handle, "invalid")
    return
  }
  try {
    await userFindByUsername({ username: handle })
    if (!activeMentions.value.includes(handle)) {
      removeMentionStatus(handle)
      return
    }
    setMentionStatus(handle, "valid")
  } catch (err: any) {
    if (!activeMentions.value.includes(handle)) {
      removeMentionStatus(handle)
      return
    }
    setMentionStatus(handle, "invalid")
  }
}

function onTextareaInput(event: Event, emitValue: (value: string) => void) {
  const target = event.target as HTMLTextAreaElement | null
  emitValue(target?.value ?? "")
  emit("update:modelValue", target?.value ?? "")
}

function onInputUpdate(value: string | number | null) {
  const normalized =
    typeof value === "string" ? value : typeof value === "number" ? String(value) : ""
  emit("update:modelValue", normalized)
}

function handleSubmit() {
  if (props.submitDisabled) return
  emit("submit")
}

function onTextareaKeydown(event: KeyboardEvent) {
  handleKeydown(event)
}

function onInputKeydown(event: KeyboardEvent) {
  handleKeydown(event)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter") return
  if (event.isComposing) return
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.defaultPrevented) return
  event.preventDefault()
  event.stopPropagation()
  handleSubmit()
}

function segmentDisplayText(segment: CommentSegment) {
  if (segment.text.length === 0) return "\u00A0"
  return segment.text
}

function focus() {
  if (textareaRef.value) {
    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(textareaRef.value.value.length, textareaRef.value.value.length)
    return
  }
  inputRef.value?.focus?.()
}

onBeforeUnmount(() => {
  resetMentionState()
})

defineExpose({
  focus,
})
</script>

<style scoped>
.media-mention-control {
  position: relative;
  width: 100%;
}

.media-mention-overlay {
  position: absolute;
  inset: 0;
  padding: 12px 16px 8px;
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
  color: inherit;
  font: inherit;
  display: block;
  z-index: 1;
}

.media-mention-overlay-segment {
  display: inline;
}

.media-mention-overlay-placeholder {
  display: inline;
  color: rgba(255, 255, 255, 0.5);
}

.media-mention-textarea {
  position: relative;
  resize: none;
  background: transparent;
  color: transparent !important;
  -webkit-text-fill-color: transparent;
  caret-color: #80deea;
  padding: 12px 16px 8px;
  line-height: inherit;
  width: 100%;
  z-index: 2;
}

.media-mention-textarea::selection {
  background: rgba(128, 222, 234, 0.35);
}

.mention-valid,
.mention-invalid,
.mention-loading {
  font-weight: 600;
}

.mention-with-tooltip {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
</style>
