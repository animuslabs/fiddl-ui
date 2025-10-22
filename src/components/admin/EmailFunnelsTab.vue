<template lang="pug">
.email-funnels-tab.q-pa-sm
  .row.items-center.q-col-gutter-sm.q-mb-sm
    h5.q-my-none Email Funnels
    q-space
    q-btn(
      color="primary"
      icon="add"
      label="New Funnel"
      unelevated
      @click="openCreateDialog"
      :disable="creating"
    )
    q-btn(
      icon="refresh"
      flat
      @click="refresh"
      :loading="isFetching"
      :disable="isLoading"
      :title="'Refresh overview'"
    )
    q-btn(
      icon="cached"
      flat
      :loading="optionsIsFetching"
      @click="reloadOptions"
      :title="'Reload handler/template options'"
    )
    q-btn(
      color="warning"
      icon="bolt"
      label="Sync Built-ins"
      unelevated
      @click="confirmSyncBuiltins"
      :loading="syncing"
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
    row-key="id"
    :rows="filteredRows"
    :columns="columns"
    :loading="isLoading || isFetching"
    v-model:pagination="pagination"
    :rows-per-page-options="[10,25,50,0]"
  )
    template(#body-cell-active="props")
      q-td(:props="props")
        q-chip(
          dense
          size="sm"
          text-color="white"
          :color="props.row.active ? 'positive' : 'grey-7'"
        ) {{ props.row.active ? 'ACTIVE' : 'PAUSED' }}
    template(#body-cell-template="props")
      q-td(:props="props")
        div.text-weight-medium {{ props.row.template?.name || '-' }}
        div.text-caption.text-grey-6(v-if="props.row.template?.subject") {{ props.row.template.subject }}
    template(#body-cell-unsubscribeGroup="props")
      q-td(:props="props")
        div.text-weight-medium {{ props.row.unsubscribeGroup?.name || '-' }}
        div.text-caption.text-grey-6(v-if="props.row.unsubscribeGroup?.key") Key: {{ props.row.unsubscribeGroup.key }}
    template(#body-cell-total="props")
      q-td(:props="props") {{ numberDisplay(props.row.stats?.total) }}
    template(#body-cell-sent="props")
      q-td(:props="props") {{ numberDisplay(props.row.stats?.sent) }}
    template(#body-cell-ready="props")
      q-td(:props="props") {{ numberDisplay(props.row.stats?.ready) }}
    template(#body-cell-pending="props")
      q-td(:props="props") {{ numberDisplay(props.row.stats?.pending) }}
    template(#body-cell-skipped="props")
      q-td(:props="props") {{ numberDisplay(props.row.stats?.skipped) }}
    template(#body-cell-failed="props")
      q-td(:props="props")
        span(:class="props.row.stats?.failed ? 'text-negative' : ''") {{ numberDisplay(props.row.stats?.failed) }}
    template(#body-cell-lastEvaluatedAt="props")
      q-td(:props="props") {{ formatDate(props.row.lastEvaluatedAt) }}
    template(#body-cell-lastSentAt="props")
      q-td(:props="props") {{ formatDate(props.row.lastSentAt) }}
    template(#body-cell-actions="props")
      q-td(:props="props")
        .row.items-center.q-gutter-xs
          q-btn(
            size="sm"
            icon="settings"
            color="primary"
            flat
            :disable="isRowUpdating(props.row.id)"
            @click="openDetailDialog(props.row)"
            label="Configure"
          )
          q-btn(
            size="sm"
            :icon="props.row.active ? 'pause' : 'play_arrow'"
            :color="props.row.active ? 'warning' : 'positive'"
            flat
            :loading="isRowUpdating(props.row.id)"
            @click="toggleActive(props.row)"
            :label="props.row.active ? 'Pause' : 'Resume'"
          )
    template(#no-data)
      .column.items-center.q-gutter-sm.q-my-xl.text-center
        q-icon(name="mail" size="42px" color="primary")
        div.text-subtitle1 Funnel scheduler has no tracked funnels yet.
        div.text-body2.text-grey-6 Use Sync Built-ins to seed default funnels from code.
        q-btn(color="warning" icon="bolt" label="Sync Built-ins" unelevated @click="confirmSyncBuiltins" :loading="syncing")

  // Detail dialog
  q-dialog(v-model="detailOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered class="funnel-dialog-card")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="settings" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Funnel Configuration
            div.text-caption.text-grey-5(v-if="selectedFunnel") {{ selectedFunnel.key }}
          q-space
          q-btn(flat dense icon="close" @click="detailOpen = false")
      q-separator
      q-card-section(class="q-gutter-y-md")
        q-form(@submit.prevent="saveDetail")
          .row.q-col-gutter-md
            .col-12.col-md-6
              q-input(v-model="form.name" label="Name" outlined dense maxlength="200")
            .col-12.col-md-6
              q-input(
                :model-value="selectedFunnel?.key || ''"
                label="Key"
                outlined
                dense
                readonly
                stack-label
              )
          .row.q-col-gutter-md
            .col-12.col-md-8
              q-input(v-model="form.description" label="Description" outlined dense type="textarea" autogrow rows="2" maxlength="500")
            .col-12.col-md-4
              q-input(
                :model-value="selectedFunnel?.shouldSendKey || ''"
                label="Should Send Key"
                outlined
                dense
                readonly
                stack-label
              )
          .row.q-col-gutter-md
            .col-12.col-md-6
              q-select(
                v-model="form.handlerKey"
                :options="handlerOptions"
                label="Handler Key"
                outlined
                dense
                emit-value
                map-options
                :loading="optionsLoading"
                behavior="menu"
              )
                template(#option="scope")
                  q-item(v-bind="scope.itemProps")
                    q-item-section
                      q-item-label {{ scope.opt.label }}
                      q-item-label(caption v-if="scope.opt.description") {{ scope.opt.description }}
                    q-item-section(side v-if="scope.opt.batchLabel")
                      q-chip(dense size="sm" color="grey-7" text-color="white") {{ scope.opt.batchLabel }}
                template(#after)
                  div.text-caption.text-negative.q-mt-xs(v-if="handlerChanged") Switching handlers updates eligibility logic. Confirm before saving.
            .col-12.col-md-6
              q-toggle(v-model="form.active" label="Active" color="positive")
          .row.q-col-gutter-md
            .col-12.col-md-6
              q-select(
                v-model="form.templateId"
                :options="templateOptions"
                label="Template"
                outlined
                dense
                emit-value
                map-options
                :loading="optionsLoading"
                behavior="menu"
              )
                template(#option="scope")
                  q-item(v-bind="scope.itemProps")
                    q-item-section
                      q-item-label {{ scope.opt.label }}
                      q-item-label(caption v-if="scope.opt.subject") Subject: {{ scope.opt.subject }}
                    q-item-section(side)
                      q-chip(dense size="sm" color="grey-7" text-color="white") {{ scope.opt.key }}
            .col-12.col-md-6
              q-select(
                v-model="form.unsubscribeGroupId"
                :options="groupOptions"
                label="Unsubscribe Group"
                outlined
                dense
                emit-value
                map-options
                :loading="optionsLoading"
                behavior="menu"
              )
                template(#option="scope")
                  q-item(v-bind="scope.itemProps")
                    q-item-section
                      q-item-label {{ scope.opt.label }}
                      q-item-label(caption v-if="scope.opt.description") {{ scope.opt.description }}
                    q-item-section(side v-if="scope.opt.key")
                      q-chip(dense size="sm" color="grey-7" text-color="white") {{ scope.opt.key }}
          .row.q-col-gutter-md
            .col-12.col-sm-6
              q-input(
                v-model.number="form.sendDelaySeconds"
                type="number"
                outlined
                dense
                label="Send Delay (seconds)"
                :min="0"
                hint="Wait between evaluating eligibility and sending"
              )
            .col-12.col-sm-6
              q-input(
                v-model.number="form.cooldownHours"
                type="number"
                outlined
                dense
                label="Cooldown (hours)"
                :min="0"
                hint="Minimum hours between sends to the same user (blank to unset)"
                clearable
              )
          .column.q-gutter-xs
            q-banner(dense rounded color="grey-9" text-color="white" icon="tips_and_updates")
              template(#avatar)
                q-icon(name="subject" color="amber-3")
              .text-body2 {{ templatePreview }}
              .text-caption.text-grey-3 Handler implementations can override subject/body at send time.
          .column.q-gutter-sm
            .text-subtitle2 Preview & Test Email
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
            .row.q-col-gutter-md.items-center
              .col-12.col-md-4
                q-toggle(
                  v-model="testForce"
                  label="Force send"
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
                  @click="sendTestEmail"
                  :disable="!hasTestUser || testingEmail"
                  :loading="testingEmail"
                )
            div.text-caption.text-grey-6 Provide a user ID to evaluate eligibility or queue a forced send for diagnostics.
          q-card-section.no-padding
            .row.q-col-gutter-sm.q-my-sm
              .col-auto
                q-chip(color="primary" text-color="white" dense) Total {{ numberDisplay(selectedFunnel?.stats?.total) }}
              .col-auto
                q-chip(color="positive" text-color="white" dense) Sent {{ numberDisplay(selectedFunnel?.stats?.sent) }}
              .col-auto
                q-chip(color="warning" text-color="white" dense) Ready {{ numberDisplay(selectedFunnel?.stats?.ready) }}
              .col-auto
                q-chip(color="accent" text-color="white" dense) Pending {{ numberDisplay(selectedFunnel?.stats?.pending) }}
              .col-auto
                q-chip(color="grey-8" text-color="white" dense) Skipped {{ numberDisplay(selectedFunnel?.stats?.skipped) }}
              .col-auto
                q-chip(color="negative" text-color="white" dense) Failed {{ numberDisplay(selectedFunnel?.stats?.failed) }}
            .row.q-col-gutter-sm
              .col-12.col-sm-6.text-caption.text-grey-5 Last evaluated: {{ formatDate(selectedFunnel?.lastEvaluatedAt) }}
              .col-12.col-sm-6.text-caption.text-grey-5 Last sent: {{ formatDate(selectedFunnel?.lastSentAt) }}
          q-separator(class="q-my-md")
          .column.q-gutter-sm
            .row.items-center.q-col-gutter-sm
              .text-subtitle2 Recent Activity
              q-space
              q-btn(
                icon="refresh"
                flat
                size="sm"
                :loading="activityLoading"
                @click="loadRecentActivity"
                :disable="!selectedFunnel"
              )
              q-btn(
                icon="play_arrow"
                flat
                size="sm"
                disable
                :title="'Evaluate Now is planned in a future backend update'"
                label="Evaluate Now"
              )
            q-table(
              flat
              bordered
              dense
              :rows="activityRows"
              :columns="activityColumns"
              row-key="id"
              :loading="activityLoading"
              :rows-per-page-options="[5,10,20,0]"
              :no-data-label="'Activity feed not yet available'"
            )
              template(#body-cell-status="props")
                q-td(:props="props")
                  q-chip(size="sm" dense color="primary" text-color="white") {{ props.row.status }}
              template(#no-data)
                .text-caption.text-grey-6.q-pa-md Backend endpoint for recent activity is pending.
          q-card-actions(align="right")
            q-btn(flat label="Close" @click="detailOpen = false")
            q-btn(
              color="primary"
              label="Save Changes"
              type="submit"
              :loading="detailSaving"
              :disable="detailSaving"
            )

  // Preview dialog
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
            .text-caption.text-grey-3 Handler output may differ at send time.
          q-banner(dense rounded color="grey-8" text-color="white" icon="psychology" v-if="previewShouldReason")
            .text-body2 {{ previewShouldReason }}
          .row.justify-end.items-center.q-gutter-xs
            span.text-caption.text-grey-5.q-mr-sm Theme
            q-btn-toggle(
              v-model="previewTheme"
              size="sm"
              rounded
              unelevated
              toggle-color="primary"
              :options="previewThemeOptions"
            )
          q-card(flat bordered)
            q-card-section(:class="['preview-card', previewThemeClass]")
              div.preview-html(:class="previewThemeClass" v-html="previewHtml")
          q-card(flat bordered v-if="previewText")
            q-card-section(:class="['preview-card', previewThemeClass]")
              pre.preview-text {{ previewText }}
        template(v-else)
          q-banner(dense rounded color="negative" text-color="white" icon="error_outline")
            .text-body2 Preview unavailable
            .text-caption.text-grey-3 {{ previewFailureReason || 'Eligibility check prevented rendering for this user.' }}
      q-card-actions(align="right")
        q-btn(flat label="Close" @click="previewDialog = false")

  // Create dialog placeholder (wired for future backend support)
  q-dialog(v-model="createOpen" :maximized="$q.screen.lt.md")
    q-card(flat bordered class="funnel-dialog-card")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="add_circle" size="32px" color="primary" class="q-mt-xs")
          .column
            .text-h6 Create Email Funnel
            .text-caption.text-grey-5 Provide defaults for a handler-driven funnel.
          q-space
          q-btn(flat dense icon="close" @click="closeCreateDialog")
      q-separator
      q-card-section(class="q-gutter-y-md")
        q-form(@submit.prevent="submitCreate")
          .row.q-col-gutter-md
            .col-12.col-md-6
              q-input(v-model="createForm.name" label="Name" outlined dense maxlength="200")
            .col-12.col-md-6
              q-input(v-model="createForm.key" label="Key" outlined dense maxlength="120" hint="Immutable identifier (slug style)")
          .row.q-col-gutter-md
            .col-12.col-md-6
              q-select(
                v-model="createForm.handlerKey"
                :options="handlerOptions"
                label="Handler Key"
                outlined
                dense
                emit-value
                map-options
                :loading="optionsLoading"
                behavior="menu"
              )
            .col-12.col-md-6
              q-select(
                v-model="createForm.templateId"
                :options="templateOptions"
                label="Template"
                outlined
                dense
                emit-value
                map-options
                :loading="optionsLoading"
                behavior="menu"
              )
          .row.q-col-gutter-md
            .col-12.col-md-6
              q-select(
                v-model="createForm.unsubscribeGroupId"
                :options="groupOptions"
                label="Unsubscribe Group"
                outlined
                dense
                emit-value
                map-options
                :loading="optionsLoading"
                behavior="menu"
              )
            .col-12.col-md-3
              q-input(
                v-model.number="createForm.sendDelaySeconds"
                type="number"
                outlined
                dense
                label="Send Delay (seconds)"
                :min="0"
              )
            .col-12.col-md-3
              q-input(
                v-model.number="createForm.cooldownHours"
                type="number"
                outlined
                dense
                label="Cooldown (hours)"
                :min="0"
                clearable
              )
          q-banner(dense rounded color="orange-8" text-color="white" icon="campaign")
            .text-body2 Backend create endpoint is rolling out. Saving will attempt to call `admin.emailFunnelCreate`.
            .text-caption.text-amber-1 Ensure the handler implementation exists before enabling.
          q-card-actions(align="right")
            q-btn(flat label="Cancel" @click="closeCreateDialog" :disable="creating")
            q-btn(color="primary" label="Create Funnel" type="submit" :loading="creating" :disable="creating")
</template>

<script lang="ts" setup>
import axios from 'axios'
import { computed, reactive, ref, watch } from 'vue'
import {
  Dialog,
  Notify,
  type QTableColumn,
  useQuasar,
} from 'quasar'
import {
  adminListUsers,
  adminEmailFunnelPreview,
  useAdminEmailFunnelsOverview,
  useAdminEmailFunnelOptions,
  useAdminEmailFunnelUpdate,
  useAdminEmailFunnelSendTest,
  useAdminEmailFunnelsSyncBuiltin,
  type AdminEmailFunnelPreviewParams,
  type AdminEmailFunnelOptions200DefinitionsItem,
  type AdminEmailFunnelOptions200TemplatesItem,
  type AdminEmailFunnelOptions200UnsubscribeGroupsItem,
  type AdminEmailFunnelPreview200,
  type AdminEmailFunnelSendTestBody,
  type AdminEmailFunnelUpdateBody,
  type AdminEmailFunnelUpdate200,
  type AdminEmailFunnelsOverview200Item,
  type AdminListUsers200UsersItem,
} from 'src/lib/orval'
import { catchErr } from 'src/lib/util'

interface HandlerOption {
  label: string
  value: string
  description?: string | null
  batchLabel?: string | null
}

interface TemplateOption {
  label: string
  value: string
  key: string
  subject?: string | null
}

interface GroupOption {
  label: string
  value: string
  key: string
  description?: string | null
}

interface FunnelFormState {
  name: string
  description: string
  active: boolean
  handlerKey: string
  templateId: string
  unsubscribeGroupId: string
  sendDelaySeconds: number
  cooldownHours: number | null
}

interface FunnelCreateForm extends Omit<FunnelFormState, 'active'> {
  key: string
  active: boolean
}

interface ActivityRow {
  id: string
  status: string
  scheduledSendAt: string | null
  sentAt: string | null
  reason: string | null
  error: string | null
}

type AdminEmailPreviewSuccess = Extract<AdminEmailFunnelPreview200, { html: string }>
type AdminEmailPreviewFailure = Extract<AdminEmailFunnelPreview200, { reason: string }>

interface UserLookupOption {
  label: string
  value: string
  email?: string | null
  username?: string | null
}

const $q = useQuasar()

const search = ref('')
const statusFilter = ref<'active' | 'all'>('active')
const statusOptions: { label: string; value: 'active' | 'all'; icon: string }[] = [
  { label: 'Active', value: 'active', icon: 'play_arrow' },
  { label: 'All', value: 'all', icon: 'all_inclusive' },
]

const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 10 })

const funnelsQuery = useAdminEmailFunnelsOverview()
const isLoading = funnelsQuery.isLoading
const isFetching = funnelsQuery.isFetching
const rows = computed<AdminEmailFunnelsOverview200Item[]>(() => funnelsQuery.data?.value?.data || [])

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

const optionsQuery = useAdminEmailFunnelOptions()
const optionsLoading = optionsQuery.isLoading
const optionsIsFetching = optionsQuery.isFetching

const definitions = computed<AdminEmailFunnelOptions200DefinitionsItem[]>(() => optionsQuery.data?.value?.data?.definitions || [])
const templates = computed<AdminEmailFunnelOptions200TemplatesItem[]>(() => optionsQuery.data?.value?.data?.templates || [])
const groups = computed<AdminEmailFunnelOptions200UnsubscribeGroupsItem[]>(() => optionsQuery.data?.value?.data?.unsubscribeGroups || [])

const handlerOptions = computed<HandlerOption[]>(() =>
  definitions.value.map((def) => ({
    label: def.key,
    value: def.key,
    description: def.description || undefined,
    batchLabel: def.candidateBatchSize ? `Batch ${def.candidateBatchSize}` : null,
  })),
)

const templateOptions = computed<TemplateOption[]>(() =>
  templates.value.map((tpl) => ({
    label: tpl.name,
    value: tpl.id,
    key: tpl.key,
    subject: tpl.subject,
  })),
)

const groupOptions = computed<GroupOption[]>(() =>
  groups.value.map((grp) => ({
    label: grp.name,
    value: grp.id,
    key: grp.key,
    description: grp.description || undefined,
  })),
)

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

const columns: QTableColumn<AdminEmailFunnelsOverview200Item>[] = [
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'key', label: 'Key', field: 'key', align: 'left', sortable: true, style: 'min-width:160px' },
  { name: 'active', label: 'Status', field: (row) => row.active, align: 'left', sortable: true },
  { name: 'template', label: 'Template', field: (row) => row.template?.name || '', align: 'left', sortable: true },
  { name: 'unsubscribeGroup', label: 'Unsubscribe Group', field: (row) => row.unsubscribeGroup?.name || '', align: 'left', sortable: true },
  { name: 'total', label: 'Total', field: (row) => row.stats?.total ?? 0, align: 'right', sortable: true },
  { name: 'sent', label: 'Sent', field: (row) => row.stats?.sent ?? 0, align: 'right', sortable: true },
  { name: 'ready', label: 'Ready', field: (row) => row.stats?.ready ?? 0, align: 'right', sortable: true },
  { name: 'pending', label: 'Pending', field: (row) => row.stats?.pending ?? 0, align: 'right', sortable: true },
  { name: 'skipped', label: 'Skipped', field: (row) => row.stats?.skipped ?? 0, align: 'right', sortable: true },
  { name: 'failed', label: 'Failed', field: (row) => row.stats?.failed ?? 0, align: 'right', sortable: true },
  { name: 'lastEvaluatedAt', label: 'Last Evaluated', field: 'lastEvaluatedAt', align: 'left', sortable: true },
  { name: 'lastSentAt', label: 'Last Sent', field: 'lastSentAt', align: 'left', sortable: true },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right', sortable: false },
]

const updateMutation = useAdminEmailFunnelUpdate()
const sendTestMutation = useAdminEmailFunnelSendTest()
const syncing = ref(false)
const syncMutation = useAdminEmailFunnelsSyncBuiltin()
const updatingMap = reactive<Record<string, boolean>>({})

function isRowUpdating(id: string): boolean {
  return !!updatingMap[id]
}

function setRowUpdating(id: string, value: boolean) {
  if (!id) return
  if (value) updatingMap[id] = true
  else delete updatingMap[id]
}

function refresh() {
  void funnelsQuery.refetch()
}

function reloadOptions() {
  void optionsQuery.refetch()
}

async function syncBuiltins() {
  if (syncing.value) return
  try {
    syncing.value = true
    await syncMutation.mutateAsync({ data: {} })
    Notify.create({ type: 'positive', message: 'Synced built-in funnels' })
    await Promise.all([funnelsQuery.refetch(), optionsQuery.refetch()])
  } catch (error) {
    catchErr(error)
  } finally {
    syncing.value = false
  }
}

function confirmSyncBuiltins() {
  Dialog.create({
    title: 'Sync Built-in Funnels',
    message: 'This will recreate built-in funnels, templates, and unsubscribe groups from code. Continue?',
    cancel: true,
    ok: { label: 'Sync built-ins', color: 'warning' },
  }).onOk(() => {
    void syncBuiltins()
  })
}

const detailOpen = ref(false)
const detailSaving = ref(false)
const selectedFunnel = ref<AdminEmailFunnelsOverview200Item | null>(null)
const initialHandlerKey = ref<string | null>(null)

const form = reactive<FunnelFormState>({
  name: '',
  description: '',
  active: true,
  handlerKey: '',
  templateId: '',
  unsubscribeGroupId: '',
  sendDelaySeconds: 0,
  cooldownHours: null,
})

const handlerChanged = computed(() => {
  if (!selectedFunnel.value) return false
  return form.handlerKey && form.handlerKey !== initialHandlerKey.value
})

const selectedTemplate = computed(() => templates.value.find((tpl) => tpl.id === form.templateId) || null)
const templatePreview = computed(() => {
  if (!selectedTemplate.value) return 'Select a template to preview its subject.'
  return `Default subject: ${selectedTemplate.value.subject || '(none set)'}`
})

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
const previewTheme = ref<'light' | 'dark'>('light')
const previewThemeOptions = [
  { label: 'Light', value: 'light', icon: 'light_mode' },
  { label: 'Dark (Gmail)', value: 'dark', icon: 'dark_mode' },
]
const previewThemeClass = computed(() => (previewTheme.value === 'dark' ? 'preview-theme-dark' : 'preview-theme-light'))

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
  previewTheme.value = 'light'
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
    const params: AdminEmailFunnelPreviewParams = { userId: trimmedUserId }
    if (selectedFunnel.value.id) params.funnelId = selectedFunnel.value.id
    else if (selectedFunnel.value.key) params.funnelKey = selectedFunnel.value.key
    const res = await adminEmailFunnelPreview(params)
    const data = res?.data
    if (data) {
      previewResult.value = data
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
      ...(testForce.value ? { force: true } : {}),
    }
    if (selectedFunnel.value.id) payload.funnelId = selectedFunnel.value.id
    else if (selectedFunnel.value.key) payload.funnelKey = selectedFunnel.value.key
    const res = await sendTestMutation.mutateAsync({ data: payload })
    const data = res?.data
    if (data?.ok) {
      const suffix = data.messageId ? ` (message ${data.messageId})` : ''
      Notify.create({ type: 'positive', message: `Test email queued${suffix}` })
    } else {
      Notify.create({ type: 'info', message: 'Test request completed; verify delivery in SendGrid logs.' })
    }
  } catch (error) {
    catchErr(error)
  } finally {
    testingEmail.value = false
  }
}

function applyFunnelToForm(funnel: AdminEmailFunnelsOverview200Item) {
  form.name = funnel.name || ''
  form.description = funnel.description || ''
  form.active = funnel.active
  form.handlerKey = funnel.handlerKey || ''
  form.templateId = funnel.template?.id || ''
  form.unsubscribeGroupId = funnel.unsubscribeGroup?.id || ''
  form.sendDelaySeconds = funnel.sendDelaySeconds ?? 0
  form.cooldownHours = funnel.cooldownHours ?? null
  initialHandlerKey.value = funnel.handlerKey || ''
}

function openDetailDialog(funnel: AdminEmailFunnelsOverview200Item) {
  selectedFunnel.value = funnel
  applyFunnelToForm(funnel)
  resetTestControls()
  detailOpen.value = true
  loadRecentActivity()
}

async function toggleActive(funnel: AdminEmailFunnelsOverview200Item) {
  if (!funnel?.id) return
  const next = !funnel.active
  try {
    setRowUpdating(funnel.id, true)
    const payload: AdminEmailFunnelUpdateBody = { id: funnel.id, active: next }
    const res = await updateMutation.mutateAsync({ data: payload })
    const updated = res?.data
    if (updated) {
      Notify.create({ type: 'positive', message: next ? 'Funnel resumed' : 'Funnel paused' })
      selectedFunnel.value = selectedFunnel.value?.id === updated.id ? updated : selectedFunnel.value
      await funnelsQuery.refetch()
    } else {
      refresh()
    }
  } catch (error) {
    catchErr(error)
  } finally {
    setRowUpdating(funnel.id, false)
  }
}

async function saveDetail() {
  if (!selectedFunnel.value) return
  const id = selectedFunnel.value.id
  if (!form.name.trim()) {
    Notify.create({ type: 'warning', message: 'Name is required' })
    return
  }
  if (!form.handlerKey) {
    Notify.create({ type: 'warning', message: 'Select a handler' })
    return
  }
  if (!form.templateId) {
    Notify.create({ type: 'warning', message: 'Select a template' })
    return
  }
  if (!form.unsubscribeGroupId) {
    Notify.create({ type: 'warning', message: 'Select an unsubscribe group' })
    return
  }
  const sendDelay = Number(form.sendDelaySeconds || 0)
  if (Number.isNaN(sendDelay) || sendDelay < 0) {
    Notify.create({ type: 'warning', message: 'Send delay must be zero or positive' })
    return
  }
  const rawCooldown = form.cooldownHours
  const cooldown = rawCooldown == null ? null : Number(rawCooldown)
  if (cooldown !== null && (Number.isNaN(cooldown) || cooldown < 0)) {
    Notify.create({ type: 'warning', message: 'Cooldown must be zero or positive' })
    return
  }
  const payload: AdminEmailFunnelUpdateBody = {
    id,
    name: form.name.trim(),
    description: form.description.trim() || null,
    active: form.active,
    handlerKey: form.handlerKey,
    templateId: form.templateId,
    unsubscribeGroupId: form.unsubscribeGroupId,
    sendDelaySeconds: sendDelay,
    cooldownHours: cooldown,
  }
  try {
    detailSaving.value = true
    const res = await updateMutation.mutateAsync({ data: payload })
    const updated = res?.data
    if (updated) {
      selectedFunnel.value = updated
      applyFunnelToForm(updated)
      Notify.create({ type: 'positive', message: 'Funnel updated' })
      void funnelsQuery.refetch()
    } else {
      Notify.create({ type: 'info', message: 'Saved changes' })
      void funnelsQuery.refetch()
    }
  } catch (error) {
    catchErr(error)
  } finally {
    detailSaving.value = false
  }
}

watch(detailOpen, (open) => {
  if (!open) {
    resetPreviewState()
  }
})

watch(testUserId, (value) => {
  if (!testUserSelection.value) return
  if (testUserSelection.value.value !== value.trim()) {
    testUserSelection.value = null
  }
})

watch(
  () => funnelsQuery.data?.value?.data,
  (list) => {
    if (!selectedFunnel.value || !Array.isArray(list)) return
    const updated = list.find((row) => row.id === selectedFunnel.value?.id)
    if (updated) {
      selectedFunnel.value = updated
      applyFunnelToForm(updated)
    }
  },
)

const activityRows = ref<ActivityRow[]>([])
const activityColumns: QTableColumn<ActivityRow>[] = [
  { name: 'status', label: 'Status', field: 'status', align: 'left', sortable: true },
  { name: 'scheduledSendAt', label: 'Scheduled', field: 'scheduledSendAt', align: 'left', sortable: true },
  { name: 'sentAt', label: 'Sent', field: 'sentAt', align: 'left', sortable: true },
  { name: 'reason', label: 'Reason', field: 'reason', align: 'left', sortable: false },
  { name: 'error', label: 'Error', field: 'error', align: 'left', sortable: false },
]
const activityLoading = ref(false)

async function loadRecentActivity() {
  if (!selectedFunnel.value?.id) return
  if (activityLoading.value) return
  activityLoading.value = true
  try {
    // Endpoint will be added server-side; gracefully ignore failures until then
    const res = await axios.get('/admin/emailFunnelActivity', { params: { funnelId: selectedFunnel.value.id, limit: 25 } })
    const data = res?.data
    if (Array.isArray(data?.items)) {
      activityRows.value = data.items.map((row: any) => ({
        id: row.id || row.recordId || `${row.funnelId || 'row'}-${row.sentAt || row.scheduledSendAt || Math.random()}`,
        status: row.status || 'unknown',
        scheduledSendAt: row.scheduledSendAt || null,
        sentAt: row.sentAt || null,
        reason: row.reason || row.shouldSendReason || null,
        error: row.error || null,
      }))
    }
  } catch (error) {
    // quietly ignore while backend stabilizes
    console.debug('Email funnel activity endpoint unavailable', error)
    activityRows.value = []
  } finally {
    activityLoading.value = false
  }
}

// --- Create funnel (awaiting backend support) ---
const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive<FunnelCreateForm>({
  key: '',
  name: '',
  description: '',
  handlerKey: '',
  templateId: '',
  unsubscribeGroupId: '',
  sendDelaySeconds: 0,
  cooldownHours: null,
  active: true,
})

function resetCreateForm() {
  createForm.key = ''
  createForm.name = ''
  createForm.description = ''
  createForm.handlerKey = ''
  createForm.templateId = ''
  createForm.unsubscribeGroupId = ''
  createForm.sendDelaySeconds = 0
  createForm.cooldownHours = null
  createForm.active = true
}

function openCreateDialog() {
  resetCreateForm()
  createOpen.value = true
}

function closeCreateDialog() {
  createOpen.value = false
}

async function submitCreate() {
  if (!createForm.key.trim()) {
    Notify.create({ type: 'warning', message: 'Key is required' })
    return
  }
  if (!createForm.name.trim()) {
    Notify.create({ type: 'warning', message: 'Name is required' })
    return
  }
  if (!createForm.handlerKey) {
    Notify.create({ type: 'warning', message: 'Select a handler' })
    return
  }
  if (!createForm.templateId) {
    Notify.create({ type: 'warning', message: 'Select a template' })
    return
  }
  if (!createForm.unsubscribeGroupId) {
    Notify.create({ type: 'warning', message: 'Select an unsubscribe group' })
    return
  }
  const sendDelay = Number(createForm.sendDelaySeconds || 0)
  if (Number.isNaN(sendDelay) || sendDelay < 0) {
    Notify.create({ type: 'warning', message: 'Send delay must be zero or positive' })
    return
  }
  const rawCooldown = createForm.cooldownHours
  const cooldown = rawCooldown == null ? null : Number(rawCooldown)
  if (cooldown != null && (Number.isNaN(cooldown) || cooldown < 0)) {
    Notify.create({ type: 'warning', message: 'Cooldown must be zero or positive' })
    return
  }
  const payload = {
    key: createForm.key.trim(),
    name: createForm.name.trim(),
    description: createForm.description.trim() || null,
    handlerKey: createForm.handlerKey,
    templateId: createForm.templateId,
    unsubscribeGroupId: createForm.unsubscribeGroupId,
    sendDelaySeconds: sendDelay,
    cooldownHours: cooldown,
    active: createForm.active,
  }
  try {
    creating.value = true
    const res = await axios.post<AdminEmailFunnelUpdate200>('/admin/emailFunnelCreate', payload)
    const created = res?.data
    if (created) {
      Notify.create({ type: 'positive', message: 'Email funnel created' })
      createOpen.value = false
      await funnelsQuery.refetch()
    } else {
      Notify.create({ type: 'warning', message: 'Create request completed without data; check server logs' })
    }
  } catch (error) {
    catchErr(error)
  } finally {
    creating.value = false
  }
}
</script>

<style lang="sass" scoped>
.email-funnels-tab
  .funnel-dialog-card
    width: min(900px, 96vw)
    max-height: 96vh
    display: flex
    flex-direction: column
  .q-card-section
    max-width: 100%
  .q-table
    .text-negative
      font-weight: 600
  .q-banner
    border: 1px solid rgba(255,255,255,0.1)
  .preview-card
    transition: background-color 0.2s ease, color 0.2s ease
    border-radius: 6px
  .preview-html
    max-height: 50vh
    overflow-y: auto
    font-size: 0.9rem
    line-height: 1.4
  .preview-text
    white-space: pre-wrap
    font-family: ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
    font-size: 0.85rem
  .preview-theme-light
    background-color: #ffffff !important
    color: #202124 !important
  .preview-theme-light :deep(body),
  .preview-theme-light :deep(table),
  .preview-theme-light :deep(td),
  .preview-theme-light :deep(tr)
    background-color: #ffffff !important
    color: #202124 !important
  .preview-theme-light :deep(a)
    color: #1a73e8 !important
  .preview-theme-dark
    background-color: #202124 !important
    color: #e8eaed !important
  .preview-theme-dark :deep(body),
  .preview-theme-dark :deep(table),
  .preview-theme-dark :deep(td),
  .preview-theme-dark :deep(tr)
    background-color: #202124 !important
    color: #e8eaed !important
  .preview-theme-dark :deep(h1),
  .preview-theme-dark :deep(h2),
  .preview-theme-dark :deep(h3),
  .preview-theme-dark :deep(h4)
    color: #f1f3f4 !important
  .preview-theme-dark :deep(a)
    color: #8ab4f8 !important
  .preview-theme-dark :deep(hr)
    border-color: rgba(232,234,237,0.25) !important
  .preview-theme-dark :deep(img)
    filter: brightness(0.95)
</style>
