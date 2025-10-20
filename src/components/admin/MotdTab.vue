<template lang="pug">
.q-pa-sm
  .row.items-center.q-col-gutter-sm.q-mb-sm
    h5.q-my-none Message of the Day
    q-space
    q-input(
      v-model="search"
      debounce="300"
      dense
      outlined
      clearable
      placeholder="Search title..."
      style="min-width:240px"
    )
    q-toggle(v-model="includeInactive" label="Include inactive" dense)
    q-btn(icon="refresh" flat @click="refetch" :loading="isFetching")
    q-btn(color="primary" icon="add" label="New MOTD" unelevated @click="openCreate")
  q-table(
    :rows="filteredRows"
    :columns="columns"
    row-key="id"
    flat
    bordered
    dense
    :loading="isLoading || isFetching"
    v-model:pagination="pagination"
    :rows-per-page-options="[10,25,50,0]"
    :no-data-label="'No MOTD entries'"
  )
    template(#body-cell-title="props")
      q-td(:props="props")
        div.text-weight-medium {{ props.row.title }}
        div.text-caption.text-grey-6(v-if="props.row.subheading") {{ props.row.subheading }}
    template(#body-cell-active="props")
      q-td(:props="props")
        q-chip(size="sm" :color="props.row.active ? 'positive' : 'grey-7'" text-color="white" dense) {{ props.row.active ? 'ACTIVE' : 'INACTIVE' }}
    template(#body-cell-startsAt="props")
      q-td(:props="props") {{ toLocalDisplay(props.row.startsAt) }}
    template(#body-cell-expiresAt="props")
      q-td(:props="props") {{ toLocalDisplay(props.row.expiresAt) }}
    template(#body-cell-updatedAt="props")
      q-td(:props="props") {{ toLocalDisplay(props.row.updatedAt) }}
    template(#body-cell-readCount="props")
      q-td(:props="props") {{ (props.row.readCount || 0).toLocaleString() }}
    template(#body-cell-actions="props")
      q-td(:props="props")
        .row.items-center.q-gutter-xs
          q-btn(size="sm" icon="visibility" flat :title="'Preview'" @click="openPreviewRow(props.row)")
          q-btn(size="sm" icon="edit" color="primary" flat :title="'Edit'" @click="openEdit(props.row)")
  q-dialog(v-model="formDialogOpen" persistent @hide="onFormDialogHide" :maximized="$q.screen.lt.md")
    q-card(class="motd-form-card")
      q-card-section
        .row.items-center.no-wrap.q-col-gutter-sm
          q-icon(:name="dialogMode === 'create' ? 'campaign' : 'edit'" color="primary" size="28px")
          .column
            div.text-h6 {{ dialogMode === 'create' ? 'Create MOTD' : 'Edit MOTD' }}
            div.text-caption.text-grey-6 Auto-saves locally until published
      q-separator
      q-form(@submit.prevent="submitForm" class="motd-form")
        q-card-section(class="motd-form-body")
          .motd-form-grid
            .motd-form-main
              q-input(v-model="form.title" label="Title" dense outlined :maxlength="200" counter)
              q-input(v-model="form.subheading" label="Subheading (optional)" dense outlined :maxlength="300" counter)
            .motd-form-editor
              q-input(
                v-model="form.body"
                type="textarea"
                outlined
                label="Markdown Body"
                :maxlength="20000"
                counter
                autogrow
                :input-style="{ minHeight: '100%' }"
              )
        q-separator
        q-card-actions(align="right" class="motd-form-actions")
          q-btn(flat label="Cancel" @click="closeForm" :disable="saving")
          q-btn(flat icon="visibility" label="Preview" @click="openPreviewForm" :disable="!form.body")
          q-btn(color="primary" :label="dialogMode === 'create' ? 'Publish' : 'Save Changes'" :loading="saving" :disable="saving" type="submit")
  q-dialog(v-model="previewOpen" transition-show="scale" transition-hide="scale" :maximized="$q.screen.lt.md")
    q-card(:class="previewCardClass" flat bordered)
      q-card-section
        .row.items-start.no-wrap.q-col-gutter-md
          q-icon(name="campaign" size="36px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs(style="min-width:0")
            .text-h6.text-weight-bold.motd-preview-title {{ previewContent?.title || 'Message of the Day' }}
            .text-caption.text-grey-5.text-uppercase(v-if="previewDay") {{ previewDay }}
            .text-body2.text-grey-4(v-if="previewContent?.subheading") {{ previewContent?.subheading }}
      q-separator
      q-card-section(:class="previewBodyClass")
        div.motd-preview-markdown(v-html="previewHtml")
      q-separator
      q-card-actions(align="right" class="motd-preview-actions")
        q-btn(flat icon="close" color="primary" label="Close" v-close-popup)
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue'
import { Notify, type QTableColumn, useQuasar } from 'quasar'
import { renderMarkdown } from 'src/lib/markdown'
import { catchErr } from 'src/lib/util'
import { useMotdList, useMotdPublish, useMotdUpdate, type MotdList200ItemsItem } from 'src/lib/orval'

type DialogMode = 'create' | 'edit'

interface MotdFormState {
  id: string | null
  title: string
  subheading: string
  body: string
}

interface DraftPayload {
  title: string
  subheading: string
  body: string
}

interface PreviewContent {
  title: string
  subheading: string | null
  body: string
  startsAt: string | null
  expiresAt: string | null
}

interface MotdSchedule {
  startsAt: string | null
  expiresAt: string | null
}

const DRAFT_STORAGE_KEY = 'admin-motd-draft'

const $q = useQuasar()
const search = ref('')
const includeInactive = ref(false)
const pagination = ref({ sortBy: 'startsAt', descending: true, page: 1, rowsPerPage: 10 })

const params = computed(() => ({
  includeInactive: includeInactive.value ? true : undefined,
}))

const motdQuery = useMotdList(params)
const isLoading = motdQuery.isLoading
const isFetching = motdQuery.isFetching
const rows = computed<MotdList200ItemsItem[]>(() => motdQuery.data?.value?.data?.items || [])

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    const title = row.title?.toLowerCase() || ''
    const subheading = row.subheading?.toLowerCase() || ''
    return title.includes(q) || subheading.includes(q)
  })
})

watch(includeInactive, () => {
  pagination.value.page = 1
  void motdQuery.refetch()
})

watch(search, () => {
  pagination.value.page = 1
})

const columns: QTableColumn<MotdList200ItemsItem>[] = [
  { name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true },
  { name: 'active', label: 'Status', field: (row) => row.active, align: 'left', sortable: true },
  { name: 'startsAt', label: 'Starts', field: 'startsAt', align: 'left', sortable: true },
  { name: 'expiresAt', label: 'Expires', field: 'expiresAt', align: 'left', sortable: true },
  { name: 'updatedAt', label: 'Updated', field: 'updatedAt', align: 'left', sortable: true },
  { name: 'readCount', label: 'Reads', field: 'readCount', align: 'right', sortable: true },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right', sortable: false },
]

const form = reactive<MotdFormState>({
  id: null,
  title: '',
  subheading: '',
  body: '',
})

const schedule = reactive<MotdSchedule>({
  startsAt: null,
  expiresAt: null,
})

const formDialogOpen = ref(false)
const dialogMode = ref<DialogMode>('create')
const saving = ref(false)

const previewOpen = ref(false)
const previewContent = ref<PreviewContent | null>(null)

const previewHtml = computed(() => renderMarkdown(previewContent.value?.body || ''))
const previewDay = computed(() => {
  const iso = previewContent.value?.startsAt
  if (!iso) return ''
  try {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
})
const previewCardClass = computed(() => ({
  'motd-preview-card': true,
  'motd-preview-card--xs': $q.screen.lt.md,
}))
const previewBodyClass = computed(() => ({
  'motd-preview-body': true,
  'motd-preview-body--xs': $q.screen.lt.md,
}))

const publishMutation = useMotdPublish()
const updateMutation = useMotdUpdate()

function resetForm() {
  form.id = null
  form.title = ''
  form.subheading = ''
  form.body = ''
  schedule.startsAt = null
  schedule.expiresAt = null
}

function loadDraft() {
  if (typeof window === 'undefined') {
    resetForm()
    return
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) {
      resetForm()
      return
    }
    const parsed = JSON.parse(raw) as DraftPayload
    resetForm()
    form.title = parsed.title || ''
    form.subheading = parsed.subheading || ''
    form.body = parsed.body || ''
  } catch {
    resetForm()
  }
}

function persistDraft(payload: DraftPayload) {
  if (typeof window === 'undefined') return
  const hasContent =
    payload.title.trim() ||
    payload.subheading.trim() ||
    payload.body.trim()
  if (!hasContent) {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload))
}

function clearDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DRAFT_STORAGE_KEY)
}

watch(
  () => ({
    title: form.title,
    subheading: form.subheading,
    body: form.body,
  }),
  (val) => {
    if (!formDialogOpen.value || dialogMode.value !== 'create') return
    persistDraft({
      title: val.title,
      subheading: val.subheading,
      body: val.body,
    })
  }
)

function openCreate() {
  dialogMode.value = 'create'
  loadDraft()
  formDialogOpen.value = true
}

function openEdit(row: MotdList200ItemsItem) {
  dialogMode.value = 'edit'
  resetForm()
  form.id = row.id
  form.title = row.title || ''
  form.subheading = row.subheading || ''
  form.body = row.body || ''
  schedule.startsAt = row.startsAt || null
  schedule.expiresAt = row.expiresAt || null
  formDialogOpen.value = true
}

function openPreviewRow(row: MotdList200ItemsItem) {
  previewContent.value = {
    title: row.title || 'Message of the Day',
    subheading: row.subheading ?? null,
    body: row.body || '',
    startsAt: row.startsAt || null,
    expiresAt: row.expiresAt || null,
  }
  previewOpen.value = true
}

function openPreviewForm() {
  previewContent.value = {
    title: form.title || 'Message of the Day',
    subheading: form.subheading ? form.subheading : null,
    body: form.body || '',
    startsAt: schedule.startsAt,
    expiresAt: schedule.expiresAt,
  }
  previewOpen.value = true
}

function closeForm() {
  formDialogOpen.value = false
}

function onFormDialogHide() {
  if (dialogMode.value === 'create') {
    // keep draft persisted; just reset in-memory state
    resetForm()
  } else {
    resetForm()
  }
  dialogMode.value = 'create'
}

async function submitForm() {
  if (saving.value) return
  const title = form.title.trim()
  const rawBody = form.body
  if (!title) {
    Notify.create({ type: 'warning', message: 'Title is required' })
    return
  }
  if (!rawBody.trim()) {
    Notify.create({ type: 'warning', message: 'Body markdown is required' })
    return
  }
  const payload: {
    title: string
    body: string
    subheading?: string
    startsAt?: string
    expiresAt?: string | null
  } = {
    title,
    body: rawBody,
  }
  const trimmedSubheading = form.subheading.trim()
  if (trimmedSubheading) {
    payload.subheading = trimmedSubheading
  }
  if (schedule.startsAt) {
    payload.startsAt = schedule.startsAt
  }
  if (schedule.expiresAt) {
    payload.expiresAt = schedule.expiresAt
  }
  try {
    saving.value = true
    if (dialogMode.value === 'create') {
      await publishMutation.mutateAsync({ data: payload })
      Notify.create({ type: 'positive', message: 'MOTD published' })
      clearDraft()
    } else if (dialogMode.value === 'edit' && form.id) {
      await updateMutation.mutateAsync({ data: { id: form.id, ...payload } })
      Notify.create({ type: 'positive', message: 'MOTD updated' })
    }
    formDialogOpen.value = false
    await motdQuery.refetch()
  } catch (error) {
    catchErr(error)
  } finally {
    saving.value = false
  }
}

function refetch() {
  void motdQuery.refetch()
}

function toLocalDisplay(value?: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '-'
  }
}
</script>

<style lang="sass" scoped>
.motd-preview-card
  width: min(720px, 92vw)
  display: flex
  flex-direction: column

.motd-preview-title
  font-size: clamp(22px, 3.2vw, 28px)
  line-height: 1.2

.motd-preview-card--xs
  width: 100%
  height: 100%
  max-width: 100%
  max-height: 100%
  border-radius: 0
  flex: 1

.motd-preview-markdown
  color: #eceff1
  font-size: 16px
  line-height: 1.5
  word-break: break-word
  :deep(a)
    color: #82e9de
    text-decoration: none
    &:hover
      text-decoration: underline
  :deep(img)
    display: block
    width: auto
    height: auto
    max-width: 100%
    max-height: 500px
    object-fit: contain
    border-radius: 6px
    margin: 12px auto
  :deep(h1)
    font-size: 22px
    line-height: 1.3
  :deep(h2)
    font-size: 19px
    line-height: 1.3
  :deep(h3)
    font-size: 18px
    line-height: 1.3
  :deep(h4), :deep(h5), :deep(h6)
    font-size: 17px
    line-height: 1.3
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6)
    margin-top: 20px
    margin-bottom: 10px
  :deep(pre)
    background: rgba(255,255,255,0.05)
    padding: 12px
    border-radius: 6px
    overflow: auto
    font-family: var(--q-code-font-family)
  :deep(code)
    background: rgba(255,255,255,0.08)
    padding: 2px 4px
    border-radius: 4px

.motd-preview-body
  max-height: 55vh
  overflow: auto

.motd-preview-body--xs
  flex: 1
  max-height: none
  overflow: auto

.motd-preview-actions
  margin-top: auto

.motd-form-card
  min-width: min(900px, 96vw)
  max-height: min(95vh, 880px)
  display: flex
  flex-direction: column

.motd-form
  display: flex
  flex-direction: column
  flex: 1 1 auto
  overflow: hidden

.motd-form-body
  flex: 1 1 auto
  overflow: hidden

.motd-form-grid
  display: flex
  flex-direction: column
  gap: 20px
  height: 100%

@media (min-width: 900px)
  .motd-form-grid
    flex-direction: row

.motd-form-main
  display: flex
  flex-direction: column
  gap: 20px
  width: 100%
  flex: 1 1 auto

@media (min-width: 900px)
  .motd-form-main
    flex: 0 0 340px
    max-width: 360px

.motd-form-editor
  flex: 1 1 auto
  display: flex
  min-height: 0

.motd-form-editor :deep(.q-field)
  flex: 1 1 auto
  display: flex
  flex-direction: column

.motd-form-editor :deep(.q-field__control)
  height: 100%

.motd-form-editor :deep(.q-field__native)
  flex: 1 1 auto
  min-height: 100%

.motd-form-editor :deep(textarea)
  flex: 1 1 auto
  resize: vertical

.motd-form-actions
  position: sticky
  bottom: 0
  background: inherit
  z-index: 1
  border-top: 1px solid var(--q-separator-color, rgba(255, 255, 255, 0.16))
  padding-top: 16px
  padding-bottom: 16px
</style>
