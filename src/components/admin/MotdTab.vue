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
    q-btn(icon="insights" flat label="Email Stats" @click="openStats")
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
          q-btn(
            size="sm"
            icon="send"
            color="info"
            flat
            :disable="props.row.telegramSent || sendingTelegram"
            :title="props.row.telegramSent ? 'Already sent to Telegram' : 'Publish to Telegram'"
            @click="openTelegramConfirm(props.row)"
          )
          q-btn(size="sm" icon="mail" color="warning" flat :disable="props.row.emailed || sending" :title="props.row.emailed ? 'Already emailed' : 'Send mass email'" @click="openSendConfirm(props.row)")
  // Inline create/edit form (simple + reliable)
  q-card(v-if="formOpen" class="motd-form-card" flat bordered)
    q-card-section
      .row.items-center.no-wrap.q-col-gutter-sm
        q-icon(:name="dialogMode === 'create' ? 'campaign' : 'edit'" color="primary" size="28px")
        .column
          div.text-h6 {{ dialogMode === 'create' ? 'Create MOTD' : 'Edit MOTD' }}
          div.text-caption.text-grey-6 Auto-saves locally until published
        q-space
        q-btn(flat dense icon="close" :label="$q.screen.gt.sm ? 'Close' : undefined" @click="closeForm")
    q-separator
    q-form(@submit.prevent="submitForm" class="motd-form")
      q-card-section(class="motd-form-body column q-gutter-y-md")
        q-input(
          v-model="form.title"
          label="Title"
          dense
          outlined
          :maxlength="200"
          counter
          :autofocus="true"
        )
        q-input(
          v-model="form.subheading"
          label="Subheading (optional)"
          dense
          outlined
          :maxlength="300"
          counter
        )
        q-input(
          v-model="form.body"
          type="textarea"
          outlined
          label="Markdown Body"
          hint="Supports Markdown"
          :hide-hint="false"
          :maxlength="20000"
          counter
          autogrow
          :rows="$q.screen.lt.md ? 10 : 18"
          class="motd-body-input"
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

  // Confirm send-email dialog
  q-dialog(v-model="confirmSendOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered style="min-width: min(560px, 96vw)")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="mail" size="28px" color="warning" class="q-mt-xs")
          .column
            .text-h6 Send MOTD via Email
            .text-caption.text-grey-6(v-if="sendTarget?.title") {{ sendTarget?.title }}
            .text-body2.q-mt-sm This will send this MOTD as an email to opted-in recipients.
            .text-negative.text-caption.q-mt-xs(v-if="sendTarget?.emailed") This MOTD has already been emailed.
      q-card-actions(align="right")
        q-btn(flat label="Cancel" v-close-popup :disable="sending")
        q-btn(color="warning" label="Send Emails" :loading="sending" :disable="sending || sendTarget?.emailed" @click="confirmSend")

  // Send results dialog
  q-dialog(v-model="sendResultOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered style="min-width: min(720px, 96vw); max-width: 96vw")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="outgoing_mail" size="28px" color="primary" class="q-mt-xs")
          .column
            .text-h6 Email Send Results
            .text-caption.text-grey-6(v-if="sendTarget?.title") {{ sendTarget?.title }}
      q-separator
      q-card-section
        .row.q-col-gutter-md
          .col-auto
            .text-body1.text-weight-medium Sent
            .text-h6 {{ sendResult?.sent || 0 }}
          .col-auto
            .text-body1.text-weight-medium Failed
            .text-h6(:class="(sendResult?.failedCount||0) > 0 ? 'text-negative' : ''") {{ sendResult?.failedCount || 0 }}
        div(v-if="(sendResult?.failures?.length || 0) > 0" class="q-mt-md")
          .text-subtitle2.text-negative.q-mb-sm Failures
          q-table(
            :rows="sendResult?.failures || []"
            :columns="failureColumns"
            row-key="email"
            flat
            bordered
            dense
            :rows-per-page-options="[10,25,50,0]"
            :no-data-label="'No failures'"
          )
      q-card-actions(align="right")
        q-btn(flat label="Close" v-close-popup)

  // Confirm send-telegram dialog
  q-dialog(v-model="confirmTelegramOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered style="min-width: min(560px, 96vw)")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="send" size="28px" color="info" class="q-mt-xs")
          .column
            .text-h6 Publish MOTD to Telegram
            .text-caption.text-grey-6(v-if="telegramTarget?.title") {{ telegramTarget?.title }}
            .text-body2.q-mt-sm This will post this MOTD to Telegram followers.
            .text-negative.text-caption.q-mt-xs(v-if="telegramTarget?.telegramSent") This MOTD has already been sent to Telegram.
      q-card-actions(align="right")
        q-btn(flat label="Cancel" v-close-popup :disable="sendingTelegram")
        q-btn(color="info" label="Publish to Telegram" :loading="sendingTelegram" :disable="sendingTelegram || telegramTarget?.telegramSent" @click="confirmTelegram")

  // Telegram results dialog
  q-dialog(v-model="telegramResultOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered style="min-width: min(560px, 96vw); max-width: 96vw")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="outgoing_mail" size="28px" color="info" class="q-mt-xs")
          .column
            .text-h6 Telegram Publish Results
            .text-caption.text-grey-6(v-if="telegramTarget?.title") {{ telegramTarget?.title }}
      q-separator
      q-card-section
        .row.q-col-gutter-lg
          .col-auto
            .text-body1.text-weight-medium Processed
            .text-h6 {{ telegramResult?.processed || 0 }}
          .col-auto
            .text-body1.text-weight-medium Sent
            .text-h6 {{ telegramResult?.sent || 0 }}
          .col-auto
            .text-body1.text-weight-medium Skipped
            .text-h6 {{ telegramResult?.skipped || 0 }}
          .col-auto
            .text-body1.text-weight-medium Errors
            .text-h6(:class="(telegramResult?.errors||0) > 0 ? 'text-negative' : ''") {{ telegramResult?.errors || 0 }}
      q-card-actions(align="right")
        q-btn(flat label="Close" v-close-popup)

  // Email stats dialog
  q-dialog(v-model="statsOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered style="min-width: min(960px, 98vw); max-width: 98vw; max-height: 96vh; display:flex; flex-direction:column")
      q-card-section
        .row.items-center
          .text-h6 Email Delivery Stats
          q-space
          q-btn(flat icon="refresh" :loading="statsIsFetching" @click="refetchStats")
          q-btn(flat icon="close" v-close-popup)
      q-separator
      q-card-section(style="flex:1; overflow:auto")
        template(v-if="statsIsLoading")
          .row.items-center.justify-center.q-my-xl
            q-spinner(color="primary" size="2em")
        template(v-else)
          q-table(
            :rows="statsRows"
            :columns="statsColumns"
            row-key="id"
            flat
            bordered
            dense
            :rows-per-page-options="[10,25,50,0]"
            :no-data-label="'No email stats available'"
          )
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue'
import { Notify, type QTableColumn, useQuasar } from 'quasar'
import { renderMarkdown } from 'src/lib/markdown'
import { catchErr } from 'src/lib/util'
import {
  useMotdList,
  useMotdPublish,
  useMotdUpdate,
  useMotdSendEmail,
  useMotdSendTelegram,
  useMotdEmailStats,
  type MotdList200ItemsItem,
  type MotdEmailStats200ItemsItem,
  type MotdSendEmail200,
  type MotdSendTelegram200,
} from 'src/lib/orval'

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

const formOpen = ref(false)
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

// No computed style required; height is handled by rows+autogrow

const publishMutation = useMotdPublish()
const updateMutation = useMotdUpdate()
const sendEmailMutation = useMotdSendEmail()
const sendTelegramMutation = useMotdSendTelegram()

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
    if (!formOpen.value || dialogMode.value !== 'create') return
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
  formOpen.value = true
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
  formOpen.value = true
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
  formOpen.value = false
  // Reset fields when closing the inline form
  resetForm()
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
    formOpen.value = false
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

// --- Send Email flow ---
const confirmSendOpen = ref(false)
const sendTarget = ref<MotdList200ItemsItem | null>(null)
const sending = ref(false)
const sendResultOpen = ref(false)
const sendResult = ref<MotdSendEmail200 | null>(null)

const failureColumns = [
  { name: 'email', label: 'Email', field: 'email', align: 'left', sortable: true },
  { name: 'reason', label: 'Reason', field: 'reason', align: 'left', sortable: true },
] as const

function openSendConfirm(row: MotdList200ItemsItem) {
  sendTarget.value = row
  confirmSendOpen.value = true
}

async function confirmSend() {
  if (!sendTarget.value) return
  try {
    sending.value = true
    const res = await sendEmailMutation.mutateAsync({ data: { id: sendTarget.value.id } })
    const payload = res?.data
    sendResult.value = payload || null
    confirmSendOpen.value = false
    sendResultOpen.value = true
    Notify.create({ type: 'positive', message: `Emails sent: ${payload?.sent ?? 0}` })
    await motdQuery.refetch()
  } catch (error) {
    catchErr(error)
  } finally {
    sending.value = false
  }
}

// --- Email stats dialog ---
const statsOpen = ref(false)
const statsQuery = useMotdEmailStats()
const statsIsLoading = statsQuery.isLoading
const statsIsFetching = statsQuery.isFetching
const statsRows = computed<MotdEmailStats200ItemsItem[]>(() => statsQuery.data?.value?.data?.items || [])

function openStats() {
  statsOpen.value = true
  // ensure fresh when opening
  void statsQuery.refetch()
}

function refetchStats() {
  void statsQuery.refetch()
}

const statsColumns = [
  { name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true },
  { name: 'startsAt', label: 'Starts', field: (row: MotdEmailStats200ItemsItem) => toLocalDisplay(row.startsAt), align: 'left', sortable: true },
  { name: 'emailed', label: 'Emailed', field: (row: MotdEmailStats200ItemsItem) => (row.emailed ? 'Yes' : 'No'), align: 'left', sortable: true },
  { name: 'processed', label: 'Processed', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.processed ?? 0, align: 'right', sortable: true },
  { name: 'delivered', label: 'Delivered', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.delivered ?? 0, align: 'right', sortable: true },
  { name: 'opens', label: 'Opens', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.opens ?? 0, align: 'right', sortable: true },
  { name: 'uniqueOpens', label: 'Unique Opens', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.uniqueOpens ?? 0, align: 'right', sortable: true },
  { name: 'clicks', label: 'Clicks', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.clicks ?? 0, align: 'right', sortable: true },
  { name: 'uniqueClicks', label: 'Unique Clicks', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.uniqueClicks ?? 0, align: 'right', sortable: true },
  { name: 'bounces', label: 'Bounces', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.bounces ?? 0, align: 'right', sortable: true },
  { name: 'spamReports', label: 'Spam', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.spamReports ?? 0, align: 'right', sortable: true },
  { name: 'unsubscribes', label: 'Unsubs', field: (row: MotdEmailStats200ItemsItem) => row.metrics?.unsubscribes ?? 0, align: 'right', sortable: true },
  { name: 'lastEventAt', label: 'Last Event', field: (row: MotdEmailStats200ItemsItem) => (row.lastEventAt ? toLocalDisplay(row.lastEventAt) : '-'), align: 'left', sortable: true },
  { name: 'error', label: 'Error', field: 'error', align: 'left', sortable: false },
] as const

// --- Send Telegram flow ---
const confirmTelegramOpen = ref(false)
const telegramTarget = ref<MotdList200ItemsItem | null>(null)
const sendingTelegram = ref(false)
const telegramResultOpen = ref(false)
const telegramResult = ref<MotdSendTelegram200 | null>(null)

function openTelegramConfirm(row: MotdList200ItemsItem) {
  telegramTarget.value = row
  confirmTelegramOpen.value = true
}

async function confirmTelegram() {
  if (!telegramTarget.value) return
  try {
    sendingTelegram.value = true
    const res = await sendTelegramMutation.mutateAsync({ data: { id: telegramTarget.value.id } })
    const payload = res?.data
    telegramResult.value = payload || null
    confirmTelegramOpen.value = false
    telegramResultOpen.value = true
    Notify.create({ type: 'positive', message: `Telegram sent: ${payload?.sent ?? 0}` })
    await motdQuery.refetch()
  } catch (error) {
    catchErr(error)
  } finally {
    sendingTelegram.value = false
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
    font-size: 26px
    line-height: 1.3
  :deep(h2)
    font-size: 22px
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
  /* inline form takes full tab width, no horizontal scroll */
  width: 100%
  max-width: 100%
  display: flex
  flex-direction: column

// Ensure the outlined border expands with the textarea
.motd-body-input
  :deep(.q-field__control)
    min-height: 44vh
  :deep(textarea)
    line-height: 1.5
    resize: vertical

.motd-form
  display: flex
  flex-direction: column
  flex: 1 1 auto
  overflow: hidden
  min-height: 0

.motd-form-body
  flex: 1 1 auto
  overflow-y: auto
  overflow-x: hidden
  min-height: 0
  display: flex
  flex-direction: column

.motd-form-body > *
  flex: 0 0 auto

.motd-form-body :deep(.q-field)
  width: 100%

// stacked layout; no grid wrappers needed

// keep default Quasar textarea behavior

.motd-form-actions
  position: sticky
  bottom: 0
  background: inherit
  z-index: 1
  border-top: 1px solid var(--q-separator-color, rgba(255, 255, 255, 0.16))
  padding-top: 16px
  padding-bottom: 16px
</style>
