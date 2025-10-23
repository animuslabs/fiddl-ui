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
          flat
          :color="props.row.active ? 'negative' : 'positive'"
          :icon="props.row.active ? 'pause' : 'play_arrow'"
          :label="props.row.active ? 'Pause' : 'Resume'"
          :loading="isFunnelToggleLoading(props.row.key)"
          :disable="isFunnelToggleLoading(props.row.key)"
          @click.stop="props.row.active ? promptPauseFunnel(props.row) : promptResumeFunnel(props.row)"
        )
        q-btn(
          size="sm"
          icon="visibility"
          color="primary"
          flat
          label="Details"
          :disable="isFunnelToggleLoading(props.row.key)"
          @click.stop="openDetailDialog(props.row)"
        )
    template(#no-data)
      .column.items-center.q-gutter-sm.q-my-xl.text-center
        q-icon(name="mail" size="42px" color="primary")
        div.text-subtitle1 No email funnels found
        div.text-body2.text-grey-6 Sync your environment to load registered funnels.

  q-dialog(v-model="detailOpen" :maximized="detailMaximized || $q.screen.lt.md")
    q-card(flat bordered :class="detailDialogClasses")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="insights" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Funnel Overview
            div.text-caption.text-grey-5(v-if="selectedFunnel") {{ selectedFunnel.name }} · {{ selectedFunnel.key }}
          q-space
          q-btn(
            v-if="selectedFunnel"
            flat
            dense
            :color="selectedFunnel.active ? 'negative' : 'positive'"
            :icon="selectedFunnel.active ? 'pause' : 'play_arrow'"
            :label="selectedFunnel.active ? 'Pause' : 'Resume'"
            :loading="isFunnelToggleLoading(selectedFunnel.key)"
            @click="selectedFunnel.active ? promptPauseFunnel(selectedFunnel) : promptResumeFunnel(selectedFunnel)"
          )
          q-btn(
            flat
            dense
            color="primary"
            icon="mail"
            label="View Emails"
            @click="openEmailsDialog"
            :disable="!selectedFunnel"
          )
          q-btn(
            flat
            dense
            :icon="detailMaximized ? 'fullscreen_exit' : 'fullscreen'"
            :title="detailMaximized ? 'Exit full screen' : 'View full screen'"
            @click="detailMaximized = !detailMaximized"
          )
          q-btn(flat dense icon="close" @click="detailOpen = false")
      q-separator
      q-card-section(class="q-gutter-y-md funnel-dialog-body" v-if="selectedFunnel")
        q-banner(
          v-if="!selectedFunnel.active"
          dense
          rounded
          color="orange-8"
          text-color="white"
          icon="pause_circle"
        )
          .text-body2 Funnel is currently paused.
          .text-caption(v-if="selectedAdminState?.pausedAt") Paused {{ formatDate(selectedAdminState?.pausedAt) }}
          .text-caption(v-if="selectedAdminState?.note") Note: {{ selectedAdminState.note }}
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
                      td.label Paused At
                      td {{ formatDate(selectedAdminState?.pausedAt) }}
                    tr
                      td.label Resumed At
                      td {{ formatDate(selectedAdminState?.resumedAt) }}
                    tr
                      td.label Admin Note
                      td {{ selectedAdminState?.note || '-' }}
                    tr
                      td.label Updated By
                      td
                        div {{ selectedAdminStateUpdatedBy || '-' }}
                        div.text-caption.text-grey-6(v-if="selectedAdminState?.updatedAt") {{ formatDate(selectedAdminState?.updatedAt) }}
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

  q-dialog(v-model="emailsDialogOpen" :maximized="emailsDialogMaximized || $q.screen.lt.md")
    q-card(flat bordered :class="emailsDialogClasses")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="mail" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Funnel Emails
            div.text-caption.text-grey-5(v-if="selectedFunnel") {{ selectedFunnel.name }} · {{ selectedFunnel.key }}
          q-space
          q-btn(
            flat
            dense
            :icon="emailsDialogMaximized ? 'fullscreen_exit' : 'fullscreen'"
            :title="emailsDialogMaximized ? 'Exit full screen' : 'View full screen'"
            @click="emailsDialogMaximized = !emailsDialogMaximized"
          )
          q-btn(flat dense icon="close" @click="emailsDialogOpen = false")
      q-separator
      q-card-section(class="q-gutter-md emails-dialog-body")
        .row.items-center.q-col-gutter-sm
          q-input(
            v-model="emailSearch"
            dense
            outlined
            debounce="300"
            clearable
            placeholder="Search subject, user, email"
            style="min-width:260px"
            :disable="emailsLoading"
          )
          q-select(
            v-model="emailStatusFilter"
            outlined
            dense
            multiple
            use-chips
            emit-value
            map-options
            :options="emailStatusOptions"
            style="min-width:220px"
            label="Statuses"
            :disable="emailsLoading"
          )
          q-space
          q-btn(
            icon="refresh"
            flat
            dense
            @click="loadEmails()"
            :loading="emailsLoading"
            :disable="emailsLoading"
            :title="'Refresh email list'"
          )
        q-banner(
          v-if="emailsFetchError"
          dense
          rounded
          color="negative"
          text-color="white"
          class="q-mt-sm"
          icon="error_outline"
        )
          .text-body2 Failed to load emails
          .text-caption.text-grey-3 Try again or adjust filters.
        q-table(
          flat
          bordered
          dense
          row-key="id"
          :rows="emailRows"
          :columns="emailColumns"
          :loading="emailsLoading"
          v-model:pagination="emailsPagination"
          :rows-per-page-options="[10,25,50,100]"
          :rows-number="emailTotal"
          binary-state-sort
          @request="handleEmailsRequest"
        )
          template(#body-cell-status="props")
            q-td(:props="props")
              q-chip(
                dense
                size="sm"
                text-color="white"
                :color="emailStatusColor(props.row.status)"
              ) {{ props.row.status.toUpperCase() }}
          template(#body-cell-user="props")
            q-td(:props="props")
              template(v-if="props.row.user")
                div.text-weight-medium {{ emailUserLabel(props.row.user) }}
                div.text-caption.text-grey-6 {{ props.row.user.id }}
              template(v-else)
                span -
          template(#body-cell-subject="props")
            q-td(:props="props")
              div.text-weight-medium {{ props.row.subject || '(no subject)' }}
              div.text-caption.text-grey-6 {{ props.row.id }}
          template(#body-cell-createdAt="props")
            q-td(:props="props") {{ formatDate(props.row.createdAt) }}
          template(#body-cell-sentAt="props")
            q-td(:props="props")
              span {{ formatDate(props.row.sentAt) }}
              div.text-caption.text-grey-6(v-if="props.row.error") Failed: {{ props.row.error }}
          template(#body-cell-actions="props")
            q-td(:props="props")
              q-btn(
                size="sm"
                icon="visibility"
                color="primary"
                flat
                label="View"
                @click.stop="openEmailPreview(props.row)"
              )
          template(#no-data)
            .column.items-center.q-gutter-sm.q-my-xl.text-center
              q-icon(name="mail_lock" size="42px" color="grey-7")
              div.text-subtitle1 No emails found
              div.text-body2.text-grey-6 Adjust filters or try another funnel.
      q-card-actions(align="right")
        q-btn(flat label="Close" @click="emailsDialogOpen = false")

  q-dialog(v-model="emailPreviewOpen" :maximized="emailPreviewMaximized || $q.screen.lt.md")
    q-card(flat bordered :class="emailPreviewDialogClasses")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="draft" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Email Details
            div.text-caption.text-grey-5(v-if="selectedEmailLog")
              span {{ selectedEmailLog.subject || '(no subject)' }} · {{ selectedEmailLog.id }}
          q-space
          q-btn(
            flat
            dense
            :icon="emailPreviewMaximized ? 'fullscreen_exit' : 'fullscreen'"
            :title="emailPreviewMaximized ? 'Exit full screen' : 'View full screen'"
            @click="emailPreviewMaximized = !emailPreviewMaximized"
          )
          q-btn(flat dense icon="close" @click="emailPreviewOpen = false")
      q-separator
      q-card-section(class="q-gutter-md emails-dialog-body")
        template(v-if="selectedEmailLog")
          q-markup-table(dense flat bordered class="info-table")
            tbody
              tr
                td.label Status
                td
                  q-chip(
                    dense
                    size="sm"
                    text-color="white"
                    :color="emailStatusColor(selectedEmailLog.status)"
                  ) {{ selectedEmailLog.status.toUpperCase() }}
              tr
                td.label Created
                td {{ formatDate(selectedEmailLog.createdAt) }}
              tr
                td.label Sent
                td {{ formatDate(selectedEmailLog.sentAt) }}
              tr
                td.label Evaluated
                td {{ formatDate(selectedEmailLog.evaluatedAt) }}
              tr
                td.label Handler
                td {{ selectedEmailLog.handlerKey || '-' }}
              tr
                td.label Should Reason
                td {{ selectedEmailLog.shouldSendReason || '-' }}
              tr
                td.label Error
                td {{ selectedEmailLog.error || '-' }}
              tr
                td.label User
                td
                  template(v-if="selectedEmailLog.user")
                    div.text-weight-medium {{ emailUserLabel(selectedEmailLog.user) }}
                    div.text-caption.text-grey-6 {{ selectedEmailLog.user.id }}
                  template(v-else)
                    span -
          q-card(flat bordered v-if="emailPreviewHtml")
            q-card-section(:class="['preview-card', { 'preview-card--max': emailPreviewMaximized }]")
              iframe.preview-iframe(
                :srcdoc="emailPreviewHtml"
                sandbox="allow-same-origin"
                referrerpolicy="no-referrer"
                :class="{ 'preview-iframe--max': emailPreviewMaximized }"
              )
          q-card(flat bordered v-if="emailPreviewText")
            q-card-section(:class="['preview-card', { 'preview-card--max': emailPreviewMaximized }]")
              pre.preview-text {{ emailPreviewText }}
          q-card(flat bordered)
            q-card-section(:class="['preview-card', { 'preview-card--max': emailPreviewMaximized }]")
              pre.preview-text {{ emailPreviewRaw }}
      q-card-actions(align="right")
        q-btn(flat label="Close" @click="emailPreviewOpen = false")

  q-dialog(v-model="previewDialog" :maximized="previewMaximized || $q.screen.lt.md")
    q-card(flat bordered :class="previewDialogClasses")
      q-card-section
        .row.items-start.q-col-gutter-md
          q-icon(name="visibility" size="32px" color="primary" class="q-mt-xs")
          .column.q-gutter-xs
            .text-h6.text-weight-medium Funnel Email Preview
            div.text-caption.text-grey-5(v-if="previewSubject") Subject: {{ previewSubject }}
          q-space
          q-btn(
            flat
            dense
            :icon="previewMaximized ? 'fullscreen_exit' : 'fullscreen'"
            :title="previewMaximized ? 'Exit full screen' : 'View full screen'"
            @click="previewMaximized = !previewMaximized"
          )
          q-btn(flat dense icon="close" @click="previewDialog = false")
      q-separator
      q-card-section(class="q-gutter-y-md funnel-dialog-body")
        template(v-if="previewSuccess")
          q-banner(dense rounded color="grey-1" text-color="grey-10" icon="mail")
            .text-body2 Preview generated for user {{ previewUserLabel }}
            .text-caption.text-grey-3 Handler output may vary at send time.
          q-banner(dense rounded color="blue-grey-1" text-color="blue-grey-9" icon="psychology" v-if="previewShouldReason")
            .text-body2 {{ previewShouldReason }}
          q-card(flat bordered)
            q-card-section(:class="['preview-card', { 'preview-card--max': previewMaximized }]")
              iframe.preview-iframe(
                :srcdoc="previewHtml"
                sandbox="allow-same-origin"
                referrerpolicy="no-referrer"
                :class="{ 'preview-iframe--max': previewMaximized }"
              )
          q-card(flat bordered v-if="previewText")
            q-card-section(:class="['preview-card', { 'preview-card--max': previewMaximized }]")
              pre.preview-text {{ previewText }}
        template(v-else)
          q-banner(dense rounded color="red-1" text-color="red-9" icon="error_outline")
            .text-body2 Preview unavailable
            .text-caption.text-grey-3 {{ previewFailureReason || 'Eligibility check prevented rendering for this user.' }}
      q-card-actions(align="right")
        q-btn(flat label="Close" @click="previewDialog = false")
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { Dialog, Notify, type QTableColumn, useQuasar } from 'quasar'
import {
  adminListEmailFunnelEmails,
  adminListUsers,
  adminEmailFunnelPreview,
  useAdminEmailFunnelEngagement,
  useAdminEmailFunnelSetActive,
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
  type AdminListEmailFunnelEmails200ItemsItem,
  type AdminListEmailFunnelEmailsParams,
  type AdminListEmailFunnelEmailsSortBy,
  type AdminListEmailFunnelEmailsSortDir,
  type AdminEmailFunnelSetActiveBody,
  AdminListEmailFunnelEmailsStatusesItem as AdminEmailStatusEnum,
  type AdminListEmailFunnelEmailsStatusesItem as AdminEmailStatus,
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

type EmailLogItem = AdminListEmailFunnelEmails200ItemsItem
interface ParsedEmailContent {
  html: string
  text: string
  raw: string
}

interface TableRequestPayload {
  pagination: {
    sortBy: string
    descending: boolean
    page: number
    rowsPerPage: number
  }
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

const setActiveMutation = useAdminEmailFunnelSetActive()
const funnelToggleLoading = ref<Record<string, boolean>>({})

function setFunnelToggleLoading(key: string, loading: boolean) {
  funnelToggleLoading.value = { ...funnelToggleLoading.value, [key]: loading }
}

function isFunnelToggleLoading(key: string): boolean {
  return !!funnelToggleLoading.value[key]
}

function syncFunnelActiveState(key: string, active: boolean, adminState: EmailFunnelOverview['adminState']) {
  const current = funnelsQuery.data.value
  if (Array.isArray(current)) {
    const updated = current.map((row) =>
      row.key === key
        ? {
            ...row,
            active,
            adminState,
          }
        : row,
    )
    funnelsQuery.data.value = updated
  }
  if (selectedFunnel.value?.key === key && selectedFunnel.value) {
    selectedFunnel.value = {
      ...selectedFunnel.value,
      active,
      adminState,
    }
  }
}

async function applyFunnelActiveState(funnel: EmailFunnelOverview, active: boolean, note?: string) {
  if (!funnel?.key) return
  const key = funnel.key
  if (isFunnelToggleLoading(key)) return
  setFunnelToggleLoading(key, true)
  const trimmedNote = typeof note === 'string' ? note.trim() : ''
  const payload: AdminEmailFunnelSetActiveBody = {
    funnelKey: key,
    active,
    note: trimmedNote ? trimmedNote : null,
  }
  try {
    const response = await setActiveMutation.mutateAsync({ data: payload })
    const data = response?.data
    if (data?.ok) {
      syncFunnelActiveState(key, active, data.adminState ?? null)
      Notify.create({
        type: 'positive',
        message: active ? 'Funnel resumed' : 'Funnel paused',
      })
      void refresh()
    } else {
      Notify.create({
        type: 'info',
        message: active ? 'Resume request completed; verify status shortly.' : 'Pause request completed; verify status shortly.',
      })
      void refresh()
    }
  } catch (error) {
    catchErr(error)
  } finally {
    setFunnelToggleLoading(key, false)
  }
}

function promptPauseFunnel(funnel: EmailFunnelOverview) {
  if (!funnel) return
  if (isFunnelToggleLoading(funnel.key)) return
  const label = funnel.name || funnel.key
  Dialog.create({
    title: 'Pause Email Funnel',
    message: `Pause "${label}"? Pending sends will stop until resumed.`,
    cancel: true,
    ok: { label: 'Pause funnel', color: 'negative' },
    prompt: {
      model: '',
      type: 'textarea',
      label: 'Pause note (optional)',
      autogrow: true,
      counter: true,
      maxlength: 500,
    },
  }).onOk((note: string) => {
    void applyFunnelActiveState(funnel, false, note)
  })
}

function promptResumeFunnel(funnel: EmailFunnelOverview) {
  if (!funnel) return
  if (isFunnelToggleLoading(funnel.key)) return
  const label = funnel.name || funnel.key
  Dialog.create({
    title: 'Resume Email Funnel',
    message: `Resume "${label}"? Eligible users may start receiving emails again.`,
    cancel: true,
    ok: { label: 'Resume funnel', color: 'positive' },
    prompt: {
      model: '',
      type: 'textarea',
      label: 'Resume note (optional)',
      autogrow: true,
      counter: true,
      maxlength: 500,
    },
  }).onOk((note: string) => {
    void applyFunnelActiveState(funnel, true, note)
  })
}

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
const detailMaximized = ref(true)
const selectedFunnel = ref<EmailFunnelOverview | null>(null)

const selectedEngagement = computed<EmailFunnelEngagement | null>(() => {
  const key = selectedFunnel.value?.key
  if (!key) return null
  return engagementMap.value.get(key) ?? null
})

const selectedAdminState = computed(() => selectedFunnel.value?.adminState ?? null)
const selectedAdminStateUpdatedBy = computed(() => {
  const state = selectedAdminState.value
  if (!state) return ''
  const parts: string[] = []
  if (state.updatedByUsername) parts.push(`@${state.updatedByUsername}`)
  if (state.updatedByEmail) parts.push(state.updatedByEmail)
  if (state.updatedByUserId) parts.push(state.updatedByUserId)
  return parts.filter(Boolean).join(' · ')
})

const engagementWindowLabel = computed(() => {
  if (!selectedEngagement.value) return ''
  return `Recent window since ${formatDate(selectedEngagement.value.recentWindowStart)}`
})

const emailStatusLabels: Record<AdminEmailStatus, string> = {
  pending: 'Pending',
  ready: 'Ready',
  sent: 'Sent',
  skipped: 'Skipped',
  failed: 'Failed',
}

const emailStatuses = Object.values(AdminEmailStatusEnum) as AdminEmailStatus[]
const emailStatusOptions = emailStatuses.map((status) => ({
  label: emailStatusLabels[status],
  value: status,
}))

const emailsDialogOpen = ref(false)
const emailsDialogMaximized = ref(true)
const emailPreviewOpen = ref(false)
const emailPreviewMaximized = ref(false)
const emailSearch = ref('')
const emailStatusFilter = ref<AdminEmailStatus[]>([])
const emailsPagination = ref({ sortBy: 'createdAt', descending: true, page: 1, rowsPerPage: 25 })
const emailRows = ref<EmailLogItem[]>([])
const emailTotal = ref(0)
const emailsLoading = ref(false)
const emailsFetchError = ref(false)
const selectedEmailLog = ref<EmailLogItem | null>(null)
let emailsRequestId = 0

const emailSortableMap: Record<string, AdminListEmailFunnelEmailsSortBy> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  evaluatedAt: 'evaluatedAt',
  scheduledSendAt: 'scheduledSendAt',
  sentAt: 'sentAt',
}

const emailColumns = computed<QTableColumn<EmailLogItem>[]>(() => [
  { name: 'status', label: 'Status', field: 'status', align: 'left', sortable: true },
  {
    name: 'user',
    label: 'User',
    field: (row) => row.user?.id || '',
    align: 'left',
    sortable: false,
  },
  { name: 'subject', label: 'Subject', field: 'subject', align: 'left', sortable: false },
  { name: 'createdAt', label: 'Created', field: 'createdAt', align: 'left', sortable: true },
  { name: 'sentAt', label: 'Sent', field: 'sentAt', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right', sortable: false },
])

const emailsDialogClasses = computed(() => ({
  'funnel-dialog-card': true,
  'funnel-dialog-card--max': emailsDialogMaximized.value,
}))

const emailPreviewDialogClasses = computed(() => ({
  'funnel-dialog-card': true,
  'funnel-preview-card': true,
  'funnel-dialog-card--max': emailPreviewMaximized.value,
  'preview-maximized': emailPreviewMaximized.value,
}))

const emailPreviewContent = computed<ParsedEmailContent>(() => parseEmailContent(selectedEmailLog.value?.email))
const emailPreviewHtml = computed(() => emailPreviewContent.value.html)
const emailPreviewText = computed(() => emailPreviewContent.value.text)
const emailPreviewRaw = computed(() => emailPreviewContent.value.raw)

function refresh() {
  void Promise.all([funnelsQuery.refetch(), engagementQuery.refetch()])
}

function openDetailDialog(funnel: EmailFunnelOverview) {
  selectedFunnel.value = funnel
  resetTestControls()
  detailMaximized.value = true
  detailOpen.value = true
}

function openEmailsDialog() {
  if (!selectedFunnel.value) return
  emailsDialogMaximized.value = true
  emailsDialogOpen.value = true
  emailPreviewOpen.value = false
  selectedEmailLog.value = null
  emailsPagination.value = {
    sortBy: emailsPagination.value.sortBy,
    descending: emailsPagination.value.descending,
    page: 1,
    rowsPerPage: emailsPagination.value.rowsPerPage,
  }
}

function handleEmailsRequest(props: TableRequestPayload) {
  emailsPagination.value = {
    sortBy: props.pagination.sortBy,
    descending: props.pagination.descending,
    page: props.pagination.page,
    rowsPerPage: props.pagination.rowsPerPage,
  }
  void loadEmails()
}

function emailStatusColor(status: AdminEmailStatus): string {
  switch (status) {
    case 'sent':
      return 'positive'
    case 'ready':
      return 'warning'
    case 'pending':
      return 'accent'
    case 'skipped':
      return 'grey-7'
    case 'failed':
      return 'negative'
    default:
      return 'grey-6'
  }
}

function emailUserLabel(user: NonNullable<EmailLogItem['user']>): string {
  const parts: string[] = []
  if (user.username) parts.push(`@${user.username}`)
  if (user.email) parts.push(user.email)
  if (!parts.length) parts.push(user.id)
  return parts.join(' · ')
}

function buildEmailParams(): AdminListEmailFunnelEmailsParams | null {
  const funnelKey = selectedFunnel.value?.key
  if (!funnelKey) return null
  const paginationState = emailsPagination.value
  const rowsPerPage = paginationState.rowsPerPage > 0 ? paginationState.rowsPerPage : undefined
  const offset = rowsPerPage ? (paginationState.page - 1) * rowsPerPage : undefined
  const sortBy = paginationState.sortBy ? emailSortableMap[paginationState.sortBy] : undefined
  const sortDir: AdminListEmailFunnelEmailsSortDir | undefined =
    sortBy && paginationState.descending ? 'desc' : sortBy ? 'asc' : undefined
  const searchTerm = emailSearch.value.trim()
  const statuses = emailStatusFilter.value.length ? [...emailStatusFilter.value] : undefined
  const params: AdminListEmailFunnelEmailsParams = {
    funnelKeys: [funnelKey],
    limit: rowsPerPage,
    offset,
    search: searchTerm || undefined,
    statuses,
    sortBy,
    sortDir,
  }
  return params
}

async function loadEmails() {
  const params = buildEmailParams()
  if (!params) {
    emailRows.value = []
    emailTotal.value = 0
    return
  }
  const requestId = ++emailsRequestId
  emailsLoading.value = true
  emailsFetchError.value = false
  try {
    const response = await adminListEmailFunnelEmails(params)
    if (requestId !== emailsRequestId) return
    const payload = response?.data
    emailRows.value = payload?.items ?? []
    emailTotal.value = typeof payload?.total === 'number' ? payload.total : payload?.items?.length ?? 0
  } catch (error) {
    if (requestId === emailsRequestId) {
      emailsFetchError.value = true
      catchErr(error)
    }
  } finally {
    if (requestId === emailsRequestId) {
      emailsLoading.value = false
    }
  }
}

function openEmailPreview(row: EmailLogItem) {
  selectedEmailLog.value = row
  emailPreviewMaximized.value = false
  emailPreviewOpen.value = true
}

function parseEmailContent(raw?: string | null): ParsedEmailContent {
  const original = typeof raw === 'string' ? raw : ''
  if (!original) return { html: '', text: '', raw: '' }
  const trimmed = original.trim()
  if (!trimmed) return { html: '', text: '', raw: '' }
  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>
        const content =
          typeof obj.content === 'object' && obj.content !== null ? (obj.content as Record<string, unknown>) : null
        const html =
          typeof obj.html === 'string'
            ? (obj.html as string)
            : content && typeof content.html === 'string'
            ? (content.html as string)
            : ''
        const text =
          typeof obj.text === 'string'
            ? (obj.text as string)
            : content && typeof content.text === 'string'
            ? (content.text as string)
            : ''
        if (html || text) {
          return { html, text, raw: original }
        }
      }
    } catch {
      // fall through and treat as raw markup/text content
    }
  }
  const looksLikeHtml = /<[^>]+>/.test(trimmed)
  return looksLikeHtml ? { html: original, text: '', raw: original } : { html: '', text: original, raw: original }
}

watch(rows, (list) => {
  if (!selectedFunnel.value) return
  const updated = list.find((row) => row.key === selectedFunnel.value?.key)
  if (updated) {
    selectedFunnel.value = updated
  }
})

watch(
  () => emailsDialogOpen.value,
  (open) => {
    if (open) {
      emailsDialogMaximized.value = true
      emailsPagination.value.page = 1
      void loadEmails()
    } else {
      emailsDialogMaximized.value = true
      emailPreviewOpen.value = false
      emailPreviewMaximized.value = false
      selectedEmailLog.value = null
    }
  },
)

watch(
  () => selectedFunnel.value?.key,
  (key) => {
    if (!key) {
      emailRows.value = []
      emailTotal.value = 0
      emailsFetchError.value = false
      return
    }
    if (emailsDialogOpen.value) {
      emailsPagination.value.page = 1
      void loadEmails()
    }
  },
)

watch(
  () => emailPreviewOpen.value,
  (open) => {
    if (!open) {
      emailPreviewMaximized.value = false
    }
  },
)

watch(
  emailSearch,
  () => {
    if (!emailsDialogOpen.value) return
    emailsPagination.value.page = 1
    void loadEmails()
  },
)

watch(
  emailStatusFilter,
  () => {
    if (!emailsDialogOpen.value) return
    emailsPagination.value.page = 1
    void loadEmails()
  },
  { deep: true },
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
const previewMaximized = ref(false)

const testUserIdValid = computed(() => uuidRegex.test(testUserId.value.trim()))
const testUserIdError = computed(() => {
  if (!testUserId.value) return ''
  return testUserIdValid.value ? '' : 'Enter a valid UUID user ID'
})
const hasTestUser = computed(() => testUserIdValid.value)

const detailDialogClasses = computed(() => ({
  'funnel-dialog-card': true,
  'funnel-dialog-card--max': detailMaximized.value,
}))

const previewDialogClasses = computed(() => ({
  'funnel-dialog-card': true,
  'funnel-preview-card': true,
  'funnel-dialog-card--max': previewMaximized.value,
  'preview-maximized': previewMaximized.value,
}))

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

watch(
  () => detailOpen.value,
  (open) => {
    if (!open) {
      resetTestControls()
      emailsDialogOpen.value = false
      selectedFunnel.value = null
      detailMaximized.value = true
    }
  },
)

watch(
  () => previewDialog.value,
  (open) => {
    if (!open) previewMaximized.value = false
  },
)

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
  previewMaximized.value = false
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
    width: min(1200px, 95vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    color: #1f1f1f;
  }

  .funnel-dialog-card--max {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }

  .funnel-preview-card {
    background: #ffffff;
    color: #1f1f1f;
  }

  .funnel-dialog-body,
  .emails-dialog-body {
    flex: 1 1 auto;
    overflow-y: auto;
  }

  .funnel-dialog-card .q-card-actions {
    border-top: 1px solid #e3e6ea;
    padding: 12px 16px;
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
    background: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e3e6ea;
    display: flex;
    flex-direction: column;
  }

  .preview-card--max {
    min-height: clamp(420px, 80vh, calc(100vh - 220px));
    flex: 1 1 auto;
  }

  .preview-iframe {
    width: 100%;
    min-height: clamp(360px, 60vh, 560px);
    height: 100%;
    border: none;
    background: white;
  }

  .preview-iframe--max {
    min-height: clamp(420px, 80vh, calc(100vh - 220px));
    flex: 1 1 auto;
  }

  .preview-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.85rem;
    line-height: 1.4;
    overflow-x: auto;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e3e6ea;
    padding: 12px;
  }

  .preview-maximized {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }

  @media (min-width: 1024px) {
    .funnel-dialog-card {
      width: min(1400px, 96vw);
    }
  }
}
</style>
