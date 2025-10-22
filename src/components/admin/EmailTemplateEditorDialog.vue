<template lang="pug">
q-dialog(:model-value="isOpen" @update:model-value="$emit('update:modelValue', $event)" :maximized="$q.screen.lt.md")
  q-card(flat bordered class="funnel-dialog-card")
    q-card-section
      .row.items-start.q-col-gutter-md
        q-icon(name="edit_note" size="32px" color="primary" class="q-mt-xs")
        .column.q-gutter-xs
          .text-h6.text-weight-medium Email Template Editor
          div.text-caption.text-grey-5 {{ headerCaption }}
        q-space
        q-btn(flat dense icon="close" @click="$emit('update:modelValue', false)" :disable="saving")
    q-separator
    q-card-section
      template(v-if="loading")
        .column.q-gutter-sm
          q-skeleton(type="rect" height="24px" animated)
          q-skeleton(type="rect" height="18px" animated)
          q-skeleton(type="rect" height="180px" animated)
      template(v-else-if="!props.templateId")
        q-banner(dense rounded color="negative" text-color="white" icon="error_outline")
          .text-body2 Template not available
          .text-caption.text-grey-3 Select a template before opening the editor.
      template(v-else)
        q-form.q-gutter-y-md(@submit.prevent="save")
          q-banner(dense rounded color="grey-9" text-color="white" icon="article")
            .text-body2 {{ templateTitle }}
            .text-caption.text-grey-3 Key: {{ props.templateKey }}
            div.text-caption.text-grey-4(v-if="updatedAtDisplay") Updated {{ updatedAtDisplay }}
          q-input(
            v-model="form.subject"
            label="Subject"
            outlined
            dense
            maxlength="240"
            :disable="saving"
          )
          q-input(
            v-model="form.description"
            label="Description"
            outlined
            dense
            type="textarea"
            autogrow
            rows="2"
            maxlength="400"
            :disable="saving"
          )
          q-input(
            v-model="form.bodyMarkdown"
            label="Body (Markdown)"
            outlined
            type="textarea"
            autogrow
            :rows="10"
            maxlength="20000"
            counter
            :disable="saving"
          )
          q-banner(dense rounded color="grey-8" text-color="white" icon="visibility")
            .text-body2 Live Preview
            .text-caption.text-grey-3 Uses Markdown rendering; dynamic handler substitutions still apply at send time.
          q-card(flat bordered)
            q-card-section
              div.template-preview(v-if="form.bodyMarkdown" v-html="previewHtml")
              div.text-caption.text-grey-6(v-else) Body is currently empty.
          q-card(flat bordered v-if="metadataString")
            q-card-section
              .text-caption.text-grey-7.q-mb-xs Metadata
              pre.metadata-block {{ metadataString }}
          .row.justify-end.q-col-gutter-sm
            q-btn(flat label="Close" @click="$emit('update:modelValue', false)" :disable="saving")
            q-btn(
              color="primary"
              label="Save Template"
              type="submit"
              :loading="saving"
              :disable="saving || !dirty"
            )
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { fetchAdminEmailTemplate, updateAdminEmailTemplate, type AdminEmailTemplateDetail } from 'src/lib/adminEmailTemplates'
import { renderMarkdown } from 'src/lib/markdown'
import { catchErr } from 'src/lib/util'

const props = defineProps<{
  modelValue: boolean
  templateId: string
  templateKey: string
  templateName: string
  templateDescription?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', template: AdminEmailTemplateDetail): void
}>()

const $q = useQuasar()
const loading = ref(false)
const saving = ref(false)
const template = ref<AdminEmailTemplateDetail | null>(null)
const currentTemplateId = ref<string>('')

const form = reactive({
  subject: '',
  description: '',
  bodyMarkdown: '',
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const headerCaption = computed(() => {
  if (!props.templateKey) return ''
  return `Editing ${props.templateKey}`
})

const templateTitle = computed(() => template.value?.name || props.templateName || 'Untitled template')

const updatedAtDisplay = computed(() => {
  const value = template.value?.updatedAt
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
})

const previewHtml = computed(() => renderMarkdown(form.bodyMarkdown || ''))

const metadataString = computed(() => {
  const meta = template.value?.metadataJson
  if (!meta || Object.keys(meta).length === 0) return ''
  try {
    return JSON.stringify(meta, null, 2)
  } catch {
    return ''
  }
})

const dirty = computed(() => {
  if (!template.value) return false
  const trimmedSubject = form.subject.trim()
  const trimmedDescription = form.description.trim()
  const originalSubject = (template.value.subject || '').trim()
  const originalDescription = (template.value.description || '').trim()
  return (
    trimmedSubject !== originalSubject ||
    trimmedDescription !== originalDescription ||
    form.bodyMarkdown !== (template.value.bodyMarkdown || '')
  )
})

function assignForm(detail: AdminEmailTemplateDetail | null) {
  form.subject = detail?.subject ?? ''
  form.description = detail?.description ?? ''
  form.bodyMarkdown = detail?.bodyMarkdown ?? ''
}

function resetState() {
  template.value = null
  currentTemplateId.value = ''
  assignForm(null)
  loading.value = false
  saving.value = false
}

async function loadTemplate() {
  if (!props.templateId) return
  loading.value = true
  try {
    const detail = await fetchAdminEmailTemplate(props.templateId)
    template.value = detail
    currentTemplateId.value = detail.id
    assignForm(detail)
  } catch (error) {
    catchErr(error)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!template.value) return
  const subject = form.subject.trim()
  if (!subject) {
    Notify.create({ type: 'warning', message: 'Subject is required' })
    return
  }
  saving.value = true
  try {
    const payload = {
      id: template.value.id,
      subject,
      bodyMarkdown: form.bodyMarkdown,
      description: form.description.trim() || null,
      metadataJson: template.value.metadataJson ?? null,
    }
    const res = await updateAdminEmailTemplate(payload)
    if (res?.template) {
      template.value = res.template
      assignForm(res.template)
      emit('saved', res.template)
      Notify.create({ type: 'positive', message: 'Template saved' })
    } else {
      Notify.create({ type: 'info', message: 'Template updated' })
    }
  } catch (error) {
    catchErr(error)
  } finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (!template.value || currentTemplateId.value !== props.templateId) {
        void loadTemplate()
      }
    } else {
      resetState()
    }
  },
)

watch(
  () => props.templateId,
  (id) => {
    if (!props.modelValue) return
    if (!id || id === currentTemplateId.value) return
    void loadTemplate()
  },
)
</script>

<style scoped>
.template-preview {
  font-size: 14px;
  line-height: 1.5;
  max-height: 340px;
  overflow-y: auto;
}

.template-preview :deep(p) {
  margin: 0 0 8px;
}

.template-preview :deep(h1),
.template-preview :deep(h2),
.template-preview :deep(h3),
.template-preview :deep(h4) {
  margin: 12px 0 6px;
}

.metadata-block {
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
</style>
