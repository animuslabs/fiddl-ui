<template lang="pug">
.email-funnels-tab.q-pa-sm
  .row.items-center.q-col-gutter-sm.q-mb-sm
    h5.q-my-none Email Funnels
    q-space
    q-select(
      v-model="sinceDays"
      :options="sinceDaysOptions"
      outlined
      dense
      emit-value
      map-options
      option-value="value"
      option-label="label"
      style="width: 150px"
      label="Window"
      :loading="isLoading"
    )
    q-btn(
      icon="refresh"
      flat
      @click="refresh"
      :loading="isFetching"
      :disable="isLoading"
      :title="'Refresh overview'"
    )
  .row.items-center.q-col-gutter-sm.q-mb-md
    q-btn-toggle(
      v-model="statusFilter"
      :options="statusOptions"
      unelevated
      size="sm"
    )
    q-input(
      v-model="search"
      dense
      outlined
      debounce="200"
      clearable
      placeholder="Search name or key"
      style="min-width:260px"
    )
    q-space
    q-badge(color="grey-8" v-if="filteredRows.length !== rows.length") {{ filteredRows.length }} / {{ rows.length }}
  q-table(
    flat
    bordered
    dense
    row-key="key"
    :rows="filteredRows"
    :columns="columns"
    :loading="isLoading"
    v-model:pagination="pagination"
    :rows-per-page-options="[10,25,50,0]"
    @row-click="(_, row) => openDetailDialog(row)"
  )
    template(#body-cell-name="props")
      q-td(:props="props")
        div.text-weight-medium {{ props.row.name }}
        div.text-caption.text-grey-6 {{ props.row.key }}
        div.text-caption.text-grey-5(v-if="props.row.description") {{ props.row.description }}
    template(#body-cell-active="props")
      q-td(:props="props")
        q-chip(
          dense
          size="sm"
          text-color="white"
          :color="props.row.active ? 'positive' : 'grey-7'"
        ) {{ props.row.active ? 'ACTIVE' : 'PAUSED' }}
    template(#body-cell-sent="props")
      q-td(:props="props") {{ numberDisplay(props.row.stats?.sent) }}
    template(#body-cell-sentRecent="props")
      q-td(:props="props") {{ numberDisplay(props.row.recent?.sent) }}
    template(#body-cell-skippedRecent="props")
      q-td(:props="props") {{ numberDisplay(props.row.recent?.skipped) }}
    template(#body-cell-lastSentAt="props")
      q-td(:props="props")
        span {{ formatDate(props.row.lastSentAt) }}
        div.text-caption.text-grey-6(v-if="props.row.lastSentReason") {{ props.row.lastSentReason }}
    template(#body-cell-lastErrorAt="props")
      q-td(:props="props")
        span(:class="props.row.lastErrorAt ? 'text-negative' : ''") {{ formatDate(props.row.lastErrorAt) }}
        div.text-caption.text-negative(v-if="props.row.lastError") {{ props.row.lastError }}
    template(#body-cell-actions="props")
      q-td(:props="props")
        q-btn(
          size="sm"
          icon="visibility"
          color="primary"
          flat
          label="Details"
          @click.stop="openDetailDialog(props.row)"
        )
    template(#no-data)
      .column.items-center.q-gutter-sm.q-my-xl.text-center
        q-icon(name="mail" size="42px" color="primary")
        div.text-subtitle1 No email funnels found
        div.text-body2.text-grey-6 Sync your environment to load registered funnels.

  q-dialog(v-model="detailOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered class="funnel-dialog-card")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="insights" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Funnel Overview
            div.text-caption.text-grey-5(v-if="selectedFunnel") {{ selectedFunnel.name }} · {{ selectedFunnel.key }}
          q-space
          q-btn(flat dense icon="close" @click="detailOpen = false")
      q-separator
      q-card-section(class="q-gutter-y-md" v-if="selectedFunnel")
        q-banner(
          v-if="selectedFunnel.lastErrorAt"
          dense
          rounded
          color="negative"
          text-color="white"
          icon="error_outline"
        )
          .text-body2 Latest error {{ formatDate(selectedFunnel.lastErrorAt) }}
          .text-caption.text-grey-3 {{ selectedFunnel.lastError || 'See logs for details.' }}
        .row.q-col-gutter-md
          .col-12.col-md-7
            q-card(flat bordered)
              q-card-section
                .text-subtitle2.text-weight-medium Lifecycle & Status
                q-markup-table(dense flat bordered class="info-table q-mt-sm")
                  tbody
                    tr
                      td.label Key
                      td {{ selectedFunnel.key }}
                    tr
                      td.label Active
                      td {{ selectedFunnel.active ? 'Yes' : 'No' }}
                    tr
                      td.label Handler
                      td {{ selectedFunnel.handlerKey }}
                    tr
                      td.label Should Send
                      td {{ selectedFunnel.shouldSendKey }}
                    tr
                      td.label Send Delay
                      td {{ selectedFunnel.sendDelaySeconds }}s
                    tr
                      td.label Cooldown
                      td {{ selectedFunnel.cooldownHours != null ? selectedFunnel.cooldownHours + 'h' : 'None' }}
                    tr
                      td.label Batch Size
                      td {{ selectedFunnel.candidateBatchSize != null ? selectedFunnel.candidateBatchSize : 'Default' }}
                    tr
                      td.label Manual Trigger
                      td {{ selectedFunnel.supportsManualTrigger ? 'Supported' : 'Not supported' }}
                    tr
                      td.label Last Evaluated
                      td {{ formatDate(selectedFunnel.lastEvaluatedAt) }}
                    tr
                      td.label Last Sent
                      td
                        div {{ formatDate(selectedFunnel.lastSentAt) }}
                        div.text-caption.text-grey-6(v-if="selectedFunnel.lastSentReason") Reason: {{ selectedFunnel.lastSentReason }}
          .col-12.col-md-5
            q-card(flat bordered)
              q-card-section
                .text-subtitle2.text-weight-medium Unsubscribe Group
                q-markup-table(dense flat bordered class="info-table q-mt-sm")
                  tbody
                    tr
                      td.label Name
                      td {{ selectedFunnel.unsubscribeGroup.name }}
                    tr
                      td.label Key
                      td {{ selectedFunnel.unsubscribeGroup.key }}
                    tr(v-if="selectedFunnel.unsubscribeGroup.description")
                      td.label Description
                      td {{ selectedFunnel.unsubscribeGroup.description }}
                    tr
                      td.label SendGrid ID
                      td {{ selectedFunnel.unsubscribeGroup.sendgridGroupId ?? 'n/a' }}

        q-card(flat bordered)
          q-card-section
            .row.items-center.no-wrap
              .text-subtitle2.text-weight-medium Lifetime Stats
              q-space
              q-chip(color="grey-8" text-color="white" dense) Total {{ numberDisplay(selectedFunnel.stats.total) }}
            .row.q-col-gutter-sm.q-mt-sm
              .col-auto
                q-chip(color="positive" text-color="white" dense) Sent {{ numberDisplay(selectedFunnel.stats.sent) }}
              .col-auto
                q-chip(color="warning" text-color="white" dense) Ready {{ numberDisplay(selectedFunnel.stats.ready) }}
              .col-auto
                q-chip(color="accent" text-color="white" dense) Pending {{ numberDisplay(selectedFunnel.stats.pending) }}
              .col-auto
                q-chip(color="grey-7" text-color="white" dense) Skipped {{ numberDisplay(selectedFunnel.stats.skipped) }}
              .col-auto
                q-chip(color="negative" text-color="white" dense) Failed {{ numberDisplay(selectedFunnel.stats.failed) }}
        q-card(flat bordered)
          q-card-section
            .text-subtitle2.text-weight-medium Recent Window
            div.text-caption.text-grey-6 Window since {{ formatDate(selectedFunnel.recentWindowStart) }}
            .row.q-col-gutter-sm.q-mt-sm
              .col-auto
                q-chip(color="positive" text-color="white" dense) Sent {{ numberDisplay(selectedFunnel.recent.sent) }}
              .col-auto
                q-chip(color="warning" text-color="white" dense) Ready {{ numberDisplay(selectedFunnel.recent.ready) }}
              .col-auto
                q-chip(color="accent" text-color="white" dense) Pending {{ numberDisplay(selectedFunnel.recent.pending) }}
              .col-auto
                q-chip(color="grey-7" text-color="white" dense) Skipped {{ numberDisplay(selectedFunnel.recent.skipped) }}
              .col-auto
                q-chip(color="negative" text-color="white" dense) Failed {{ numberDisplay(selectedFunnel.recent.failed) }}
        q-card(flat bordered)
          q-card-section
            .row.items-center.no-wrap
              .text-subtitle2.text-weight-medium Engagement
              q-space
              span.text-caption.text-grey-6(v-if="engagementWindowLabel") {{ engagementWindowLabel }}
            q-markup-table(dense flat bordered class="info-table q-mt-sm")
              thead
                tr
                  th
                  th.text-center Lifetime
                  th.text-center Recent
              tbody
                tr
                  td Opens
                  td.text-center {{ numberDisplay(selectedEngagement?.opensTotal) }} ({{ numberDisplay(selectedEngagement?.opensUnique) }} unique)
                  td.text-center {{ numberDisplay(selectedEngagement?.opensTotalRecent) }} ({{ numberDisplay(selectedEngagement?.opensUniqueRecent) }} unique)
                tr
                  td Clicks
                  td.text-center {{ numberDisplay(selectedEngagement?.clicksTotal) }} ({{ numberDisplay(selectedEngagement?.clicksUnique) }} unique)
                  td.text-center {{ numberDisplay(selectedEngagement?.clicksTotalRecent) }} ({{ numberDisplay(selectedEngagement?.clicksUniqueRecent) }} unique)
                tr
                  td Sent
                  td.text-center {{ numberDisplay(selectedEngagement?.sentTotal) }}
                  td.text-center {{ numberDisplay(selectedEngagement?.sentRecent) }}
        q-card(flat bordered)
          q-card-section
            .text-subtitle2.text-weight-medium Top Reasons
            template(v-if="selectedFunnel.reasons.length")
              q-markup-table(dense flat bordered class="info-table q-mt-sm")
                thead
                  tr
                    th Reason
                    th.text-right Count
                tbody
                  tr(v-for="reason in selectedFunnel.reasons" :key="reason.reason")
                    td {{ reason.reason }}
                    td.text-right {{ numberDisplay(reason.count) }}
            template(v-else)
              div.text-caption.text-grey-6 No reasons tracked for this window.
        q-card(flat bordered)
          q-card-section(class="q-gutter-md")
            .row.items-center.no-wrap
              .text-subtitle2.text-weight-medium Preview & Send Test
              q-space
              q-chip(v-if="!selectedFunnel.supportsManualTrigger" color="orange-8" text-color="white" dense) Manual trigger disabled
            .row.q-col-gutter-md
              .col-12.col-md-6
                q-select(
                  v-model="testUserSelection"
                  label="Find user (username/email)"
                  outlined
                  dense
                  clearable
                  use-input
                  fill-input
                  input-debounce="0"
                  :options="userLookupOptions"
                  :loading="userLookupLoading"
                  @filter="filterUserLookup"
                  @update:model-value="handleUserSelection"
                  behavior="menu"
                )
                  template(#option="scope")
                    q-item(v-bind="scope.itemProps")
                      q-item-section
                        q-item-label {{ scope.opt.label }}
                        q-item-label(caption v-if="scope.opt.email || scope.opt.username")
                          span(v-if="scope.opt.username") @{{ scope.opt.username }}
                          span(v-if="scope.opt.email && scope.opt.username") ·
                          span(v-if="scope.opt.email") {{ scope.opt.email }}
                      q-item-section(side)
                        q-chip(dense size="sm" color="grey-7" text-color="white") {{ scope.opt.value }}
                  template(#no-option)
                    q-item
                      q-item-section.text-grey-6 No matches found
              .col-12.col-md-6
                q-input(
                  v-model="testUserId"
                  label="User ID (UUID)"
                  outlined
                  dense
                  clearable
                  placeholder="Paste user ID or select above"
                  :disable="previewLoading || testingEmail"
                  :error="!!testUserIdError"
                  :error-message="testUserIdError"
                  autocomplete="off"
                  @keydown.enter.prevent="openPreviewEmail"
                )
            div.text-caption.text-grey-6(v-if="testUserSelectionInfo") {{ testUserSelectionInfo }}
            .row.items-center.q-col-gutter-sm
              .col-auto
                q-toggle(
                  v-model="testForce"
                  label="Force send (ignore eligibility)"
                  color="warning"
                  dense
                  :disable="previewLoading || testingEmail"
                )
            .row.q-col-gutter-sm
              .col-auto
                q-btn(
                  size="sm"
                  color="secondary"
                  flat
                  icon="visibility"
                  label="Preview Email"
                  @click="openPreviewEmail"
                  :disable="!hasTestUser || previewLoading"
                  :loading="previewLoading"
                )
              .col-auto
                q-btn(
                  size="sm"
                  color="primary"
                  unelevated
                  icon="send"
                  label="Send Test"
                  @click="confirmSendTest"
                  :disable="!hasTestUser || testingEmail || !selectedFunnel.supportsManualTrigger"
                  :loading="testingEmail"
                )
            div.text-caption.text-grey-6 Provide a user ID to evaluate eligibility or force a delivery for diagnostics.
      q-card-actions(align="right")
        q-btn(flat label="Close" @click="detailOpen = false")

  q-dialog(v-model="previewDialog" :maximized="$q.screen.lt.md")
    q-card(flat bordered class="funnel-dialog-card")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="visibility" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Funnel Email Preview
            div.text-caption.text-grey-5(v-if="previewSubject") Subject: {{ previewSubject }}
          q-space
          q-btn(flat dense icon="close" @click="previewDialog = false")
      q-separator
      q-card-section(class="q-gutter-y-md")
        template(v-if="previewSuccess")
          q-banner(dense rounded color="grey-9" text-color="white" icon="mail")
            .text-body2 Preview generated for user {{ previewUserLabel }}
            .text-caption.text-grey-3 Handler output may vary at send time.
          q-banner(dense rounded color="grey-8" text-color="white" icon="psychology" v-if="previewShouldReason")
            .text-body2 {{ previewShouldReason }}
          q-card(flat bordered)
            q-card-section(class="preview-card")
              iframe.preview-iframe(
                :srcdoc="previewHtml"
                sandbox="allow-same-origin"
                referrerpolicy="no-referrer"
              )
          q-card(flat bordered v-if="previewText")
            q-card-section(class="preview-card")
              pre.preview-text {{ previewText }}
        template(v-else)
          q-banner(dense rounded color="negative" text-color="white" icon="error_outline")
            .text-body2 Preview unavailable
            .text-caption.text-grey-3 {{ previewFailureReason || 'Eligibility check prevented rendering for this user.' }}
      q-card-actions(align="right")
        q-btn(flat label="Close" @click="previewDialog = false")
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { Dialog, Notify, type QTableColumn, useQuasar } from 'quasar'
import {
  adminListUsers,
  adminEmailFunnelPreview,
  useAdminEmailFunnelEngagement,
  useAdminEmailFunnelSendTest,
  useAdminEmailFunnelsOverview,
  type AdminEmailFunnelPreview200,
  type AdminEmailFunnelEngagement200Item,
  type AdminEmailFunnelEngagementParams,
  type AdminEmailFunnelPreviewParams,
  type AdminEmailFunnelSendTestBody,
  type AdminEmailFunnelsOverview200Item,
  type AdminEmailFunnelsOverviewParams,
  type AdminListUsers200UsersItem,
} from 'src/lib/orval'
import { catchErr } from 'src/lib/util'

type EmailFunnelOverview = AdminEmailFunnelsOverview200Item
type EmailFunnelStatusCounts = EmailFunnelOverview['stats']
type EmailFunnelEngagement = AdminEmailFunnelEngagement200Item

type AdminEmailPreviewSuccess = Extract<AdminEmailFunnelPreview200, { html: string }>
type AdminEmailPreviewFailure = Extract<AdminEmailFunnelPreview200, { reason: string }>

interface UserLookupOption {
  label: string
  value: string
  email?: string | null
  username?: string | null
}

const $q = useQuasar()

function normalizeCounts(source?: Partial<EmailFunnelStatusCounts> | null): EmailFunnelStatusCounts {
  return {
    total: typeof source?.total === 'number' ? source.total : 0,
    sent: typeof source?.sent === 'number' ? source.sent : 0,
    ready: typeof source?.ready === 'number' ? source.ready : 0,
    pending: typeof source?.pending === 'number' ? source.pending : 0,
    skipped: typeof source?.skipped === 'number' ? source.skipped : 0,
    failed: typeof source?.failed === 'number' ? source.failed : 0,
  }
}

const sinceDaysOptions = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

const sinceDays = ref(30)
const search = ref('')
const statusFilter = ref<'active' | 'all'>('active')
const statusOptions: { label: string; value: 'active' | 'all'; icon: string }[] = [
  { label: 'Active', value: 'active', icon: 'play_arrow' },
  { label: 'All', value: 'all', icon: 'all_inclusive' },
]

const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 10 })

const overviewParams = computed<AdminEmailFunnelsOverviewParams>(() => ({ sinceDays: sinceDays.value }))

const funnelsQuery = useAdminEmailFunnelsOverview<EmailFunnelOverview[]>(overviewParams, {
  query: {
    retry: 0,
    select: (response) => {
      const list = response?.data ?? []
      return list.map((row) => ({
        ...row,
        stats: normalizeCounts(row.stats),
        recent: normalizeCounts(row.recent),
        reasons: Array.isArray(row.reasons) ? row.reasons : [],
      }))
    },
  },
})

const engagementParams = computed<AdminEmailFunnelEngagementParams>(() => ({ sinceDays: sinceDays.value }))

const engagementQuery = useAdminEmailFunnelEngagement<EmailFunnelEngagement[]>(engagementParams, {
  query: {
    retry: 0,
    select: (response) => response?.data ?? [],
  },
})

const rows = computed<EmailFunnelOverview[]>(() => funnelsQuery.data.value ?? [])
const isLoading = computed(() => funnelsQuery.isLoading.value)
const isFetching = computed(() => funnelsQuery.isFetching.value || engagementQuery.isFetching.value)

const filteredRows = computed(() => {
  const list = statusFilter.value === 'active' ? rows.value.filter((row) => row.active) : rows.value
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((row) => {
    const name = row.name?.toLowerCase() || ''
    const key = row.key?.toLowerCase() || ''
    return name.includes(q) || key.includes(q)
  })
})

watch([search, statusFilter], () => {
  pagination.value.page = 1
})

watch(
  () => funnelsQuery.error.value,
  (error) => {
    if (error) catchErr(error)
  },
)

watch(
  () => engagementQuery.error.value,
  (error) => {
    if (error) catchErr(error)
  },
)

const columns = computed<QTableColumn<EmailFunnelOverview>[]>(() => [
  { name: 'name', label: 'Funnel', field: 'name', align: 'left', sortable: true },
  { name: 'active', label: 'Status', field: (row) => row.active, align: 'left', sortable: true },
  { name: 'sent', label: 'Sent', field: (row) => row.stats.sent, align: 'right', sortable: true },
  { name: 'sentRecent', label: `Sent (${sinceDays.value}d)`, field: (row) => row.recent.sent, align: 'right', sortable: true },
  { name: 'skippedRecent', label: `Skipped (${sinceDays.value}d)`, field: (row) => row.recent.skipped, align: 'right', sortable: true },
  { name: 'lastSentAt', label: 'Last Sent', field: 'lastSentAt', align: 'left', sortable: true },
  { name: 'lastErrorAt', label: 'Last Error', field: 'lastErrorAt', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'key', align: 'right', sortable: false },
])

const engagementMap = computed(() => {
  const map = new Map<string, EmailFunnelEngagement>()
  const data = engagementQuery.data.value
  const list = Array.isArray(data) ? data : []
  list.forEach((entry) => {
    map.set(entry.funnelKey, entry)
  })
  return map
})

const detailOpen = ref(false)
const selectedFunnel = ref<EmailFunnelOverview | null>(null)

const selectedEngagement = computed<EmailFunnelEngagement | null>(() => {
  const key = selectedFunnel.value?.key
  if (!key) return null
  return engagementMap.value.get(key) ?? null
})

const engagementWindowLabel = computed(() => {
  if (!selectedEngagement.value) return ''
  return `Recent window since ${formatDate(selectedEngagement.value.recentWindowStart)}`
})

function refresh() {
  void Promise.all([funnelsQuery.refetch(), engagementQuery.refetch()])
}

function openDetailDialog(funnel: EmailFunnelOverview) {
  selectedFunnel.value = funnel
  resetTestControls()
  detailOpen.value = true
}

watch(rows, (list) => {
  if (!selectedFunnel.value) return
  const updated = list.find((row) => row.key === selectedFunnel.value?.key)
  if (updated) {
    selectedFunnel.value = updated
  }
})

watch(
  () => detailOpen.value,
  (open) => {
    if (!open) {
      resetTestControls()
      selectedFunnel.value = null
    }
  },
)

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const testUserId = ref('')
const testUserSelection = ref<UserLookupOption | null>(null)
const userLookupOptions = ref<UserLookupOption[]>([])
const userLookupLoading = ref(false)
let userLookupRequestId = 0
const testForce = ref(false)
const testingEmail = ref(false)
const previewDialog = ref(false)
const previewLoading = ref(false)
const previewResult = ref<AdminEmailFunnelPreview200 | null>(null)

const testUserIdValid = computed(() => uuidRegex.test(testUserId.value.trim()))
const testUserIdError = computed(() => {
  if (!testUserId.value) return ''
  return testUserIdValid.value ? '' : 'Enter a valid UUID user ID'
})
const hasTestUser = computed(() => testUserIdValid.value)

const previewSuccess = computed<AdminEmailPreviewSuccess | null>(() => {
  const result = previewResult.value
  return result && 'html' in result ? (result as AdminEmailPreviewSuccess) : null
})
const previewFailureReason = computed(() => {
  const result = previewResult.value
  return result && 'reason' in result ? (result as AdminEmailPreviewFailure).reason : ''
})
const previewSubject = computed(() => previewSuccess.value?.subject || '')
const previewHtml = computed(() => previewSuccess.value?.html || '')
const previewText = computed(() => previewSuccess.value?.text || '')
const previewShouldReason = computed(() => previewSuccess.value?.shouldReason || '')
const previewUserLabel = computed(() => testUserSelection.value?.label || testUserId.value.trim() || 'N/A')

const testUserSelectionInfo = computed(() => {
  const opt = testUserSelection.value
  if (!opt) return ''
  const parts: string[] = []
  if (opt.username) parts.push(`@${opt.username}`)
  if (opt.email) parts.push(opt.email)
  parts.push(opt.value)
  return parts.filter(Boolean).join(' · ')
})

function resetPreviewState() {
  previewDialog.value = false
  previewResult.value = null
  previewLoading.value = false
}

function resetTestControls() {
  testUserId.value = ''
  testUserSelection.value = null
  userLookupOptions.value = []
  testForce.value = false
  testingEmail.value = false
  previewLoading.value = false
  resetPreviewState()
}

function mapUserToOption(user: AdminListUsers200UsersItem): UserLookupOption {
  const username = user.profile?.username || null
  const email = user.profile?.email || null
  const label = username ? `@${username}` : email || user.id
  return {
    label,
    value: user.id,
    email,
    username,
  }
}

function handleUserSelection(option: UserLookupOption | null) {
  if (option) {
    testUserSelection.value = option
    testUserId.value = option.value
  } else {
    testUserSelection.value = null
  }
}

function filterUserLookup(val: string, update: (fn: () => void) => void) {
  const term = val.trim()
  if (term.length < 2) {
    update(() => {
      userLookupOptions.value = []
    })
    userLookupLoading.value = false
    return
  }
  const requestId = ++userLookupRequestId
  userLookupLoading.value = true
  update(async () => {
    try {
      const res = await adminListUsers({ search: term, limit: 20, includeBanned: true })
      if (requestId !== userLookupRequestId) return
      const list = res?.data?.users || []
      userLookupOptions.value = list.map(mapUserToOption)
    } catch (error) {
      if (requestId === userLookupRequestId) catchErr(error)
    } finally {
      if (requestId === userLookupRequestId) {
        userLookupLoading.value = false
      }
    }
  })
}

async function openPreviewEmail() {
  if (!selectedFunnel.value) return
  const trimmedUserId = testUserId.value.trim()
  if (!testUserIdValid.value) {
    Notify.create({ type: 'warning', message: 'Enter a valid user ID to preview this funnel.' })
    return
  }
  if (previewLoading.value) return
  previewResult.value = null
  previewLoading.value = true
  try {
    const params: AdminEmailFunnelPreviewParams = { userId: trimmedUserId, funnelKey: selectedFunnel.value.key }
    const res = await adminEmailFunnelPreview(params)
    if (res?.data) {
      previewResult.value = res.data
      previewDialog.value = true
    } else {
      Notify.create({ type: 'info', message: 'Preview did not return data.' })
    }
  } catch (error) {
    catchErr(error)
  } finally {
    previewLoading.value = false
  }
}

const sendTestMutation = useAdminEmailFunnelSendTest()

function confirmSendTest() {
  if (!selectedFunnel.value) return
  Dialog.create({
    title: 'Send Test Email',
    message: testForce.value
      ? 'This will force an immediate send to the selected user. Continue?'
      : 'This will evaluate eligibility and send if permitted. Continue?',
    cancel: true,
    ok: { label: 'Send test', color: 'primary' },
  }).onOk(() => {
    void sendTestEmail()
  })
}

async function sendTestEmail() {
  if (!selectedFunnel.value) return
  const trimmedUserId = testUserId.value.trim()
  if (!testUserIdValid.value) {
    Notify.create({ type: 'warning', message: 'Enter a valid user ID to send a test email.' })
    return
  }
  if (testingEmail.value) return
  testingEmail.value = true
  try {
    const payload: AdminEmailFunnelSendTestBody = {
      userId: trimmedUserId,
      funnelKey: selectedFunnel.value.key,
      force: testForce.value,
    }
    const res = await sendTestMutation.mutateAsync({ data: payload })
    const data = res?.data
    if (data?.ok) {
      const suffix = data.messageId ? ` (message ${data.messageId})` : ''
      Notify.create({ type: 'positive', message: `Test email queued${suffix}` })
    } else {
      Notify.create({ type: 'info', message: data?.reason ? `Test halted: ${data.reason}` : 'Test request completed; verify delivery in SendGrid logs.' })
    }
  } catch (error) {
    catchErr(error)
  } finally {
    testingEmail.value = false
  }
}

function numberDisplay(value: number | undefined | null): string {
  const num = typeof value === 'number' ? value : 0
  return num.toLocaleString()
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}
</script>

<style lang="scss">
.email-funnels-tab {
  .funnel-dialog-card {
    max-width: 960px;
    width: 100%;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;

    td,
    th {
      padding: 6px 10px;
      vertical-align: top;
    }

    td.label {
      width: 160px;
      color: #606266;
      font-weight: 500;
      white-space: nowrap;
    }

    th {
      font-weight: 600;
      color: #444;
    }
  }

  .preview-card {
    background: #f5f5f5;
    border-radius: 6px;
  }

  .preview-iframe {
    width: 100%;
    min-height: 420px;
    border: none;
    background: white;
  }

  .preview-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.85rem;
    line-height: 1.4;
  }
}
</style>
