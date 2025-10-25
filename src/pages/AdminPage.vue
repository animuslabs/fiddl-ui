<template lang="pug">
q-page.full-height.full-width.admin-page
  .centered.q-mt-md
    h4 Admin
  div(v-if="$userAuth.loggedIn && $userAuth.userData?.admin").q-pt-md
    q-tabs(v-model="tab" ).q-mb-md
      q-tab( name="promo-codes" label="Promo Codes")
      q-tab(name="motd" label="MOTD")
      q-tab(name="email-funnels" label="Email Funnels")
      q-tab(name="users" label="Users")
      q-tab(name="user-attributions" label="User Attributions")
      q-tab(name="payments" label="Payments")
      q-tab(name="uploaded-images" label="Uploaded Images")
      q-tab(name="training-images" label="Training Set Images")
      q-tab(name="discount-codes" label="Discount Codes")
      q-tab(name="affiliate-payouts" label="Affiliate Payouts")
      q-tab(name="stats" label="Stats")
    div(v-if="tab == 'promo-codes'" class="q-pa-sm")
      // Create + stats
      q-card.q-pa-md.q-mb-md
        .row.items-center.q-col-gutter-sm
          .col-12.col-sm-3
            q-input(v-model.number="promoPoints" type="number" dense outlined label="Points per code" input-style="font-size:16px;" inputmode="numeric")
          .col-auto
            q-btn(color="primary" icon="add" label="Create + Copy Claim" @click="createPromoCode('claim')")
          .col-auto
            q-btn(color="accent" icon="add" label="Create + Copy Magic Mirror" @click="createPromoCode('mm')")
          q-space
          .col-auto
            .row.items-center.q-gutter-xs
              q-chip(color="primary" text-color="white" dense) Total: {{ promoStats.total }}
              q-chip(color="positive" text-color="white" dense) Unclaimed: {{ promoStats.unclaimed }}
              q-chip(color="grey-7" text-color="white" dense) Claimed: {{ promoStats.claimed }}
              q-chip(color="secondary" text-color="white" dense) Unclaimed Pts: {{ promoStats.unclaimedPoints.toLocaleString() }}

      // Filters
      .row.items-center.q-gutter-sm.q-mb-sm
        q-btn-toggle(
          v-model="promoFilterStatus"
          :options="promoStatusOptions"
          size="sm"
          dense
          unelevated
        )
        q-input(v-model="promoSearch" debounce="300" dense outlined clearable placeholder="Search (short id or user)" style="min-width:260px")
        q-space
        q-btn(icon="refresh" flat @click="loadPromoCodes" :loading="promoLoading")

      // Table
      q-table(
        :rows="promoFilteredRows"
        :columns="promoColumns"
        row-key="id"
        :loading="promoLoading"
        flat bordered dense
        :rows-per-page-options="[10,25,50,100,0]"
        :no-data-label="'No promo codes found'"
      )
        template(#body-cell-actions="props")
          q-td(:props="props")
            .row.items-center.q-gutter-xs
              q-btn(size="sm" icon="content_copy" flat :title="'Copy claim link'" @click="copyCode(props.row.id)")
              q-btn(size="sm" icon="qr_code" color="primary" flat :title="'Show claim QR'" @click="showClaimQr(props.row.id)")
              q-btn(size="sm" icon="extension" flat :title="'Copy Magic Mirror link'" @click="copyMagicMirror(props.row.id)")
              q-btn(size="sm" icon="bolt" flat :title="'Copy Magic Mirror Fast link'" @click="copyMagicMirrorFast(props.row.id)")
              q-btn(size="sm" icon="delete" color="negative" flat :title="'Delete code'" :disable="!!props.row.claimedAt" @click="confirmDeletePromo(props.row)")
        template(#body-cell-code="props")
          q-td(:props="props")
            .row.items-center.q-gutter-xs
              q-chip(size="sm" color="dark" text-color="white" dense) {{ shortId(props.row.id) }}
              a.admin-link(:href="claimLink(props.row.id)" target="_blank" rel="noopener" @click.stop) Open
        template(#body-cell-points="props")
          q-td(:props="props") {{ (props.row.points || 0).toLocaleString() }}
        template(#body-cell-status="props")
          q-td(:props="props")
            q-chip(v-if="props.row.claimedAt" color="grey-7" text-color="white" dense) CLAIMED
            q-chip(v-else color="positive" text-color="white" dense) AVAILABLE
        template(#body-cell-claimedBy="props")
          q-td(:props="props")
            template(v-if="props.row.claimedByUserId && profileLinkByUserId(props.row.claimedByUserId)")
              a.admin-link(:href="profileLinkByUserId(props.row.claimedByUserId)" target="_blank" rel="noopener" @click.stop)
                | {{ labelById(props.row.claimedByUserId) }}
            template(v-else-if="props.row.claimedByUserId")
              span {{ labelById(props.row.claimedByUserId) }}
            template(v-else)
              span -
        template(#body-cell-createdAt="props")
          q-td(:props="props") {{ props.row.createdAt ? new Date(props.row.createdAt).toLocaleString() : '' }}
        template(#body-cell-claimedAt="props")
          q-td(:props="props") {{ props.row.claimedAt ? new Date(props.row.claimedAt).toLocaleString() : '' }}

    // MOTD tab
    div(v-if="tab == 'motd'" class="q-pa-sm")
      MotdTab

    div(v-if="tab == 'email-funnels'" class="q-pa-sm")
      EmailFunnelsTab

    // Discount Codes tab
    div(v-if="tab == 'discount-codes'" class="q-pa-sm")
      .row.items-center.q-gutter-md
        h5.q-my-none Create Discount Code
      q-card.q-pa-md.q-mb-md
        .row.q-col-gutter-sm
          .col-12.col-sm-4
            q-input(v-model="dcForm.code" label="Code"  outlined hint="Uppercase" :rules="[v => !!v || 'Required']" @update:model-value="dcForm.code = (dcForm.code || '').toUpperCase()")
          .col-6.col-sm-2
            q-input(v-model.number="dcForm.discountPct" type="number"  outlined label="Discount %" :min="0" :max="95" :step="1" suffix="%")
          .col-6.col-sm-2
            q-input(v-model.number="dcForm.maximumUses" type="number"  outlined label="Max Uses" :min="1")
          .col-6.col-sm-3
            q-select(
              v-model="dcForm.linkedUserId"
              :options="dcUserOptionsCreate"
              label="Linked Account (optional)"
              outlined clearable use-input fill-input input-debounce="300" hide-selected
              emit-value map-options option-label="label" option-value="value" outllined
              @filter="filterDcUserCreate"
            )
        .row.items-center.q-gutter-sm.q-mt-sm
          q-btn(color="primary" icon="add" label="Create" :loading="dcCreating" @click="createDiscountCode")
          q-btn(flat icon="refresh" label="Refresh" :loading="dcFetching || dcLoading" @click="refetchDiscounts")
      q-table(
        :rows="dcRows"
        :columns="dcColumns"
        row-key="code"
        :loading="dcLoading || dcFetching"
        flat bordered dense
        :rows-per-page-options="[10,25,50,100,0]"
        :no-data-label="'No discount codes found'"
      )
        template(#body-cell-discount="props")
          q-td(:props="props") {{ Math.round((props.row.discount || 0) * 100) }}%
        template(#body-cell-uses="props")
          q-td(:props="props") {{ props.row.used }}/{{ props.row.maximumUses }}
        template(#body-cell-linkedUser="props")
          q-td(:props="props")
            template(v-if="props.row.linkedUserId && profileLinkByUserId(props.row.linkedUserId)")
              a.admin-link(:href="profileLinkByUserId(props.row.linkedUserId)" target="_blank" rel="noopener" @click.stop)
                | {{ labelById(props.row.linkedUserId) }}
            template(v-else-if="props.row.linkedUserId")
              span {{ labelById(props.row.linkedUserId) }}
            template(v-else)
              span
        template(#body-cell-pendingPayout="props")
          q-td(:props="props") ${{ (props.row.pendingPayout || 0).toFixed(2) }}
        template(#body-cell-totalPayout="props")
          q-td(:props="props") ${{ (props.row.totalPayout || 0).toFixed(2) }}
        template(#body-cell-createdAt="props")
          q-td(:props="props") {{ props.row.createdAt ? new Date(props.row.createdAt).toLocaleString() : '' }}
        template(#body-cell-actions="props")
          q-td(:props="props")
            .row.items-center.q-gutter-xs
              q-btn(size="sm" icon="edit" flat @click="openEditDiscount(props.row)")
              q-btn(size="sm" icon="delete" color="negative" flat @click="confirmDeleteDiscount(props.row)")

    // Edit dialog
    q-dialog(v-model="dcEditOpen")
      q-card(style="min-width: 360px")
        q-card-section
          h6.q-my-none Edit Discount Code
        q-card-section
          .column.q-gutter-sm
            q-input(v-model="dcEdit.code" label="Code" dense outlined disable)
            q-input(v-model.number="dcEdit.discountPct" type="number" dense outlined label="Discount %" :min="0" :max="95" :step="1" suffix="%")
            q-input(v-model.number="dcEdit.maximumUses" type="number" dense outlined label="Max Uses" :min="1")
            q-select(
              v-model="dcEdit.linkedUserId"
              :options="dcUserOptionsEdit"
              label="Linked Account (optional)"
              dense outlined clearable use-input fill-input input-debounce="300"
              emit-value map-options option-label="label" option-value="value"
              @filter="filterDcUserEdit"
            )
        q-card-actions(align="right")
          q-btn(flat label="Cancel" v-close-popup)
          q-btn(color="primary" label="Save" :loading="dcSaving" @click="saveEditDiscount")
    // Affiliate Payouts tab
    div(v-if="tab == 'affiliate-payouts'" class="q-pa-sm")
      .row.items-center.q-gutter-sm.q-mb-sm
        h5.q-my-none Users With Pending Payouts
        q-space
        q-btn(icon="refresh" flat @click="refetchDiscounts" :loading="dcFetching || dcLoading")
      q-table(
        :rows="pendingPayoutRows"
        :columns="pendingPayoutColumns"
        row-key="userId"
        flat bordered dense
        :rows-per-page-options="[10,25,50,100,0]"
        :no-data-label="'No pending payouts'"
      )
        template(#body-cell-user="props")
          q-td(:props="props")
            template(v-if="profileLinkByUserId(props.row.userId)")
              a.admin-link(:href="profileLinkByUserId(props.row.userId)" target="_blank" rel="noopener" @click.stop)
                | {{ labelById(props.row.userId) }}
            template(v-else)
              span {{ labelById(props.row.userId) }}
        template(#body-cell-paypalEmail="props")
          q-td(:props="props")
            template(v-if="payoutDetailsByUserId[props.row.userId]?.paypalEmail")
              span {{ payoutDetailsByUserId[props.row.userId]?.paypalEmail || '' }}
            template(v-else)
              span Not linked
        template(#body-cell-pending="props")
          q-td(:props="props") ${{ (props.row.pending || 0).toFixed(2) }}
        template(#body-cell-actions="props")
          q-td(:props="props")
            q-btn(size="sm" color="primary" :disable="(props.row.pending||0) <= 0" label="Payout" @click="confirmAffiliatePayout(props.row.userId, props.row.pending)")
      .row.items-center.q-gutter-sm.q-mt-md
        h6.q-my-none Recent Payout Receipts
        q-space
        q-btn(icon="refresh" flat @click="refetchAffiliateReceipts" :loading="apLoading")
      q-table(
        :rows="apReceipts"
        :columns="apColumns"
        row-key="id"
        flat bordered dense
        :rows-per-page-options="[10,25,50,100,0]"
        :loading="apLoading"
        :no-data-label="'No payout receipts'"
      )
        template(#body-cell-payoutDate="props")
          q-td(:props="props") {{ props.row.payoutDate ? new Date(props.row.payoutDate).toLocaleString() : '' }}
        template(#body-cell-user="props")
          q-td(:props="props")
            template(v-if="profileLinkByUserId(props.row.userId)")
              a.admin-link(:href="profileLinkByUserId(props.row.userId)" target="_blank" rel="noopener" @click.stop)
                | {{ labelById(props.row.userId) }}
            template(v-else)
              span {{ labelById(props.row.userId) }}
        template(#body-cell-paypalEmail="props")
          q-td(:props="props")
            template(v-if="payoutDetailsByUserId[props.row.userId]?.paypalEmail")
              span {{ payoutDetailsByUserId[props.row.userId]?.paypalEmail || '' }}
            template(v-else)
              span Not linked
        template(#body-cell-amount="props")
          q-td(:props="props") ${{ (props.row.amount || 0).toFixed(2) }}
    div(v-if="tab == 'users'").q-pa-sm
      .row.items-center.q-gutter-sm.q-mb-sm
        q-input(v-model="userSearch" debounce="400" placeholder="Search users..." dense outlined clearable style="min-width:240px")
        q-toggle(v-model="includeBanned" label="Include banned" dense)
        q-space
        q-btn(color="primary" icon="download" label="Export CSV" @click="exportUsersCsv" :loading="usersExporting")
        q-btn(icon="refresh" flat @click="refetchUsers" :loading="usersFetching")
      q-table(
        :rows="usersRows"
        :columns="userColumns"
        row-key="id"
        :loading="usersLoading || usersFetching"
        v-model:pagination="usersPagination"
        :rows-number="usersTotal"
        @request="onUsersRequest"
        binary-state-sort
        flat
        bordered
        dense
        :wrap-cells="false"
        :rows-per-page-options="[10,25,50,100,0]"
        :no-data-label="'No users found'"
      )
        template(#body-cell-actions="props")
          q-td(:props="props")
            .row.items-center.q-gutter-xs
              q-btn(size="sm" icon="login" flat @click="loginAsUser(props.row.id)")
              q-btn(size="sm" icon="block" color="negative" flat @click="confirmBan(props.row)" :disable="props.row.banned")
              q-avatar(size="28px" class="q-ml-sm")
                q-img(:src="avatarImg(props.row.id)")
        template(#body-cell-attribution="props")
          q-td(:props="props" class="no-wrap" style="white-space: nowrap;")
            .row.items-center.no-wrap.q-gutter-xs
              q-chip(
                size="sm"
                color="grey-7"
                text-color="white"
                dense
                v-if="attribSourceByUserId[props.row.id] && attribSourceByUserId[props.row.id] !== '-'"
              ) {{ attribSourceByUserId[props.row.id] }}
              q-badge(v-else color="grey-5" text-color="black" label="-")
              q-btn(
                size="sm"
                icon="insights"
                flat dense round
                :disable="!canOpenAttrib(props.row.id)"
                :loading="attribLoading[props.row.id] === true"
                :title="attributionButtonTitle(props.row.id)"
                @click="openAttributionDialog(props.row)"
              )
        template(#body-cell-username="props")
          q-td(:props="props")
            template(v-if="profileLinkForUser(props.row.profile)")
              a.admin-link(:href="profileLinkForUser(props.row.profile)" target="_blank" rel="noopener" @click.stop)
                | {{ props.row.profile?.username || '-' }}
            template(v-else)
              span {{ props.row.profile?.username || '-' }}
        template(#body-cell-banned="props")
          q-td(:props="props")
            q-chip(color="negative" text-color="white" v-if="props.row.banned" size="sm" label="BANNED")
            q-chip(color="positive" text-color="white" v-else size="sm" label="OK")
        template(#body-cell-admin="props")
          q-td(:props="props")
            q-chip(color="accent" text-color="white" v-if="props.row.admin" size="sm" label="ADMIN")
            q-chip(color="grey-5" text-color="black" v-else size="sm" label="USER")

  div(v-if="tab == 'payments'").q-pa-sm
    .row.items-center.q-gutter-sm.q-mb-sm
      q-input(v-model="paymentsUserId" debounce="400" placeholder="User ID" dense outlined clearable style="min-width:200px")
      q-select(v-model="paymentsMethod" :options="paymentsMethodOptions" label="Method" dense outlined clearable style="min-width:140px")
      q-select(v-model="paymentsStatus" :options="paymentsStatusOptions" label="Status" dense outlined clearable style="min-width:140px")
      q-input(v-model="paymentsStart" type="datetime-local" label="Start" dense outlined clearable style="min-width:220px")
      q-input(v-model="paymentsEnd" type="datetime-local" label="End" dense outlined clearable style="min-width:220px")
      q-space
      q-btn(color="primary" icon="download" label="Export CSV" @click="exportPaymentsCsv" :loading="paymentsExporting")
      q-btn(icon="refresh" flat @click="refetchPayments" :loading="paymentsFetching")
    q-table(
      :rows="paymentsRows"
      :columns="paymentsColumns"
      row-key="id"
      :loading="paymentsLoading || paymentsFetching"
      v-model:pagination="paymentsPagination"
      :rows-number="paymentsTotal"
      @request="onPaymentsRequest"
      binary-state-sort
      flat
      bordered
      dense
      :rows-per-page-options="[10,25,50,100,0]"
      :no-data-label="'No payments found'"
    )
      template(#body-cell-status="props")
        q-td(:props="props")
          q-chip(:color="statusColor(props.row.status)" text-color="white" size="sm" :label="props.row.status")
      template(#body-cell-user="props")
        q-td(:props="props")
          div
            template(v-if="props.row.user")
              template(v-if="profileLinkForUser(props.row.user)")
                a.admin-link(:href="profileLinkForUser(props.row.user)" target="_blank" rel="noopener" @click.stop)
                  | {{ userDisplay(props.row.user) }}
              template(v-else)
                span {{ userDisplay(props.row.user) }}
              q-btn(size="sm" icon="login" flat @click="loginAsUser(props.row.user.id)" class="q-ml-xs")
            template(v-else)
              span -
      template(#body-cell-attribution="props")
        q-td(:props="props" class="no-wrap" style="white-space: nowrap;")
          .row.items-center.no-wrap.q-gutter-xs
            q-chip(
              v-if="props.row.user?.id && attribSourceByUserId[props.row.user.id] && attribSourceByUserId[props.row.user.id] !== '-'"
              size="sm"
              color="grey-7"
              text-color="white"
              dense
            ) {{ attribSourceByUserId[props.row.user.id] }}
            q-badge(v-else color="grey-5" text-color="black" label="-")
            q-btn(
              size="sm"
              icon="insights"
              flat dense round
              :disable="!props.row.user?.id || !canOpenAttrib(props.row.user.id)"
              :loading="props.row.user?.id ? attribLoading[props.row.user.id] === true : false"
              :title="props.row.user?.id ? attributionButtonTitle(props.row.user.id) : 'No attribution data'"
              @click="props.row.user && openAttributionDialog(props.row.user)"
            )
      template(#body-cell-discount="props")
        q-td(:props="props")
          template(v-if="props.row.discountInfo")
            .row.items-center.q-gutter-xs
              q-chip(v-if="props.row.discountInfo.code" size="sm" dense color="primary" text-color="white" :label="props.row.discountInfo.code")
              q-chip(
                v-if="props.row.discountInfo.percent != null"
                size="sm"
                dense
                color="positive"
                text-color="white"
                :label="`-${formatDiscountPercent(props.row.discountInfo.percent)}`"
              )
              q-chip(
                v-if="props.row.discountInfo.amountUsd != null"
                size="sm"
                dense
                color="positive"
                text-color="white"
                :label="`-${formatDiscountAmount(props.row.discountInfo.amountUsd)}`"
              )
          template(v-else)
            span -
      template(#body-cell-package="props")
        q-td(:props="props")
          div(v-if="props.row.package")
            span {{ props.row.package.points?.toLocaleString() }} pts
            span.q-ml-xs ${{ props.row.package.usd?.toFixed(2) }}
            span.q-ml-xs(v-if="props.row.package.discountPct") (-{{ props.row.package.discountPct }}%)
          div(v-else) -
      template(#body-cell-details="props")
        q-td(:props="props")
          div(v-if="props.row.details")
            span(v-if="props.row.details.orderID") Order: {{ props.row.details.orderID }}
            span(v-if="props.row.details.transactionId") Tx: {{ props.row.details.transactionId }}
            span(v-if="props.row.details.chainName") Chain: {{ props.row.details.chainName }}
            span(v-if="props.row.details.tokenType") Token: {{ props.row.details.tokenType }}
            span(v-if="props.row.details.tokenAmount") Amt: {{ props.row.details.tokenAmount }}
          div(v-else) -

  // Uploaded Images tab
  div(v-if="tab == 'uploaded-images'").q-pa-sm
    .row.items-center.q-gutter-sm.q-mb-sm
      q-btn-toggle(v-model="uploadsView" :options="uploadsViewOptions" dense unelevated size="sm")
      q-input(v-model="uploadsAccount" debounce="400" placeholder="Filter by account (username/email/id)" dense outlined clearable style="min-width:260px")
      q-input(v-model="uploadsStart" type="datetime-local" label="Start" dense outlined clearable style="min-width:220px")
      q-input(v-model="uploadsEnd" type="datetime-local" label="End" dense outlined clearable style="min-width:220px")
      q-select(v-model="uploadsPagination.rowsPerPage" :options="[10,25,50,100]" label="Rows" dense outlined style="width:100px")
      q-space
      q-btn(v-if="uploadsAccount" icon="block" color="negative" flat :label="singleUploaderUser ? `Ban ${userDisplay(singleUploaderUser)}` : 'Ban account'" @click="banTopUser")
      q-btn(v-if="uploadsProfileLink" icon="open_in_new" color="primary" flat :label="uploadsProfileLabel || 'Open profile'" :href="uploadsProfileLink" target="_blank" rel="noopener")
      q-btn(icon="refresh" flat @click="refetchUploads" :loading="uploadsFetching")
    // Top page navigation (centered, large)
    .row.justify-center.q-mb-sm(ref="topPager")
      q-pagination(
        v-if="uploadsPagination.rowsPerPage !== 0 && uploadsTotal > 0"
        v-model="uploadsPagination.page"
        :max="Math.max(1, Math.ceil(uploadsTotal / uploadsPagination.rowsPerPage))"
        max-pages="8"
        boundary-links
        direction-links
        color="primary"
        size="lg"
      )
    q-table(v-if="uploadsView === 'table'"
      :rows="uploadsRows"
      :columns="uploadsColumns"
      row-key="id"
      :loading="uploadsLoading || uploadsFetching"
      v-model:pagination="uploadsPagination"
      :rows-number="uploadsTotal"
      @request="onUploadsRequest"
      binary-state-sort
      flat
      bordered
      dense
      :hide-bottom="true"
      :rows-per-page-options="[10,25,50,100,0]"
      :no-data-label="'No uploaded images found'"
    )
      template(#body-cell-preview="props")
        q-td(:props="props")
          q-img(:src="s3Img('uploads/' + props.row.id)" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" @click="openImagePreview(props.row.id)")
      template(#body-cell-user="props")
        q-td(:props="props")
          span.admin-link(@click="filterUploadsByUser(props.row.user)") {{ userDisplay(props.row.user) }}
          q-btn(
            v-if="profileLinkForUser(props.row.user)"
            size="sm"
            flat
            round
            dense
            icon="open_in_new"
            class="q-ml-xs"
            :href="profileLinkForUser(props.row.user)"
            target="_blank"
            rel="noopener"
            @click.stop
            title="Open profile in new tab"
          )
      template(#body-cell-createdAt="props")
        q-td(:props="props") {{ props.row.createdAt ? new Date(props.row.createdAt).toLocaleString() : '' }}
      template(#body-cell-actions="props")
        q-td(:props="props")
          .row.items-center.q-gutter-xs
            q-btn(size="sm" icon="delete" color="negative" flat @click="confirmDeleteUpload(props.row)")
            q-btn(size="sm" icon="block" color="negative" flat @click="banUploader(props.row)")
            q-btn(size="sm" icon="person_search" flat v-if="!uploadsAccount" @click="lookupUploader(props.row)")
    // Grid view for uploaded images
    div(v-else)
      div(v-if="uploadsLoading && !uploadsRows.length" class="row justify-center q-my-md")
        q-spinner(size="32px" color="primary")
      .row.q-col-gutter-sm
        .col-6.col-sm-4.col-md-3.col-lg-2(v-for="row in uploadsRows" :key="row.id")
          q-card(flat bordered)
            div(style="position:relative;")
              q-img(:src="s3Img('uploads/' + row.id)" style="width:100%; height:0; padding-bottom:100%; object-fit:cover; cursor:pointer;" @click="openImagePreview(row.id)")
              .row.items-center.q-gutter-xs(style="position:absolute; top:6px; right:6px;")
                q-btn(size="sm" round dense color="negative" icon="delete" @click="confirmDeleteUpload(row)")
                q-btn(size="sm" round dense color="negative" icon="block" @click="banUploader(row)")
            q-card-section(class="q-pa-sm")
              div(style="font-size:12px;" class="ellipsis row items-center no-wrap")
                span.admin-link(@click="filterUploadsByUser(row.user)") {{ userDisplay(row.user) }}
                q-btn(
                  v-if="profileLinkForUser(row.user)"
                  size="sm"
                  flat
                  round
                  dense
                  icon="open_in_new"
                  class="q-ml-xs"
                  :href="profileLinkForUser(row.user)"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                  title="Open profile in new tab"
                )
              div(style="font-size:11px; color:#777") {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '' }}
    // Bottom page navigation (centered, large)
    .row.justify-center.q-mt-sm
      q-pagination(
        v-if="uploadsPagination.rowsPerPage !== 0 && uploadsTotal > 0"
        v-model="uploadsPagination.page"
        @update:model-value="onBottomPageChange"
        :max="Math.max(1, Math.ceil(uploadsTotal / uploadsPagination.rowsPerPage))"
        max-pages="8"
        boundary-links
        direction-links
        color="primary"
        size="lg"
      )

  // Training Set Images tab
  div(v-if="tab == 'training-images'").q-pa-sm
    .row.items-center.q-gutter-sm.q-mb-sm
      q-btn-toggle(v-model="tsetsView" :options="uploadsViewOptions" dense unelevated size="sm")
      q-input(v-model="tsetsAccount" debounce="400" placeholder="Filter by account (username/email/id)" dense outlined clearable style="min-width:260px")
      q-input(v-model="tsetsStart" type="datetime-local" label="Start" dense outlined clearable style="min-width:220px")
      q-input(v-model="tsetsEnd" type="datetime-local" label="End" dense outlined clearable style="min-width:220px")
      q-select(v-model="tsetsPagination.rowsPerPage" :options="[10,25,50,100]" label="Rows" dense outlined style="width:100px")
      q-space
      q-btn(v-if="tsetsAccount" icon="block" color="negative" flat :label="tsetsSingleUser ? `Ban ${userDisplay(tsetsSingleUser)}` : 'Ban account'" @click="banTopUserTsets")
      q-btn(v-if="tsetsProfileLink" icon="open_in_new" color="primary" flat :label="tsetsProfileLabel || 'Open profile'" :href="tsetsProfileLink" target="_blank" rel="noopener")
      q-btn(icon="refresh" flat @click="refetchTsets" :loading="tsetsFetching")
    // Top page navigation (centered, large)
    .row.justify-center.q-mb-sm(ref="tsetsTopPager")
      q-pagination(
        v-if="tsetsPagination.rowsPerPage !== 0 && tsetsTotal > 0"
        v-model="tsetsPagination.page"
        :max="Math.max(1, Math.ceil(tsetsTotal / tsetsPagination.rowsPerPage))"
        max-pages="8"
        boundary-links
        direction-links
        color="primary"
        size="lg"
      )
    q-table(v-if="tsetsView === 'table'"
      :rows="tsetsRows"
      :columns="tsetsColumns"
      row-key="thumbnailId"
      :loading="tsetsLoading || tsetsFetching"
      v-model:pagination="tsetsPagination"
      :rows-number="tsetsTotal"
      @request="onTsetsRequest"
      binary-state-sort
      flat
      bordered
      dense
      :hide-bottom="true"
      :rows-per-page-options="[10,25,50,100,0]"
      :no-data-label="'No training set images found'"
    )
      template(#body-cell-preview="props")
        q-td(:props="props")
          q-img(:src="props.row.url" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" @click="openThumbPreview(props.row.url)")
      template(#body-cell-user="props")
        q-td(:props="props")
          span.admin-link(@click="filterTsetsByUser(props.row.user)") {{ userDisplay(props.row.user) }}
          q-btn(
            v-if="profileLinkForUser(props.row.user)"
            size="sm"
            flat
            round
            dense
            icon="open_in_new"
            class="q-ml-xs"
            :href="profileLinkForUser(props.row.user)"
            target="_blank"
            rel="noopener"
            @click.stop
            title="Open profile in new tab"
          )
      template(#body-cell-createdAt="props")
        q-td(:props="props") {{ props.row.createdAt ? new Date(props.row.createdAt).toLocaleString() : '' }}
      template(#body-cell-actions="props")
        q-td(:props="props")
          .row.items-center.q-gutter-xs
            q-btn(size="sm" icon="open_in_new" flat :href="$router.resolve({ name: 'trainingSet', params: { trainingSetId: props.row.trainingSetId } }).href" target="_blank" rel="noopener" title="Open training set")
            q-btn(size="sm" icon="block" color="negative" flat @click="banUploaderTsets(props.row)")
            q-btn(size="sm" icon="person_search" flat v-if="!tsetsAccount" @click="lookupUploaderTsets(props.row)")
    // Grid view for training images
    div(v-else)
      div(v-if="tsetsLoading && !tsetsRows.length" class="row justify-center q-my-md")
        q-spinner(size="32px" color="primary")
      .row.q-col-gutter-sm
        .col-6.col-sm-4.col-md-3.col-lg-2(v-for="row in tsetsRows" :key="row.thumbnailId")
          q-card(flat bordered)
            div(style="position:relative;")
              q-img(:src="row.url" style="width:100%; height:0; padding-bottom:100%; object-fit:cover; cursor:pointer;" @click="openThumbPreview(row.url)")
              .row.items-center.q-gutter-xs(style="position:absolute; top:6px; right:6px;")
                q-btn(size="sm" round dense color="negative" icon="block" @click="banUploaderTsets(row)")
            q-card-section(class="q-pa-sm")
              div(style="font-size:12px;" class="ellipsis row items-center no-wrap")
                span.admin-link(@click="filterTsetsByUser(row.user)") {{ userDisplay(row.user) }}
                q-btn(
                  v-if="profileLinkForUser(row.user)"
                  size="sm"
                  flat
                  round
                  dense
                  icon="open_in_new"
                  class="q-ml-xs"
                  :href="profileLinkForUser(row.user)"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                  title="Open profile in new tab"
                )
              div(style="font-size:11px; color:#777") {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '' }}
    // Bottom page navigation (centered, large)
    .row.justify-center.q-mt-sm
      q-pagination(
        v-if="tsetsPagination.rowsPerPage !== 0 && tsetsTotal > 0"
        v-model="tsetsPagination.page"
        @update:model-value="onBottomPageChangeTsets"
        :max="Math.max(1, Math.ceil(tsetsTotal / tsetsPagination.rowsPerPage))"
        max-pages="8"
        boundary-links
        direction-links
        color="primary"
        size="lg"
      )

  // Stats tab
  div(v-if="tab == 'stats'").q-pa-sm
    AdminStats

  // User Attributions tab
  div(v-if="tab == 'user-attributions'" class="q-pa-sm")
    UserAttributionsTab

  // Show a spinner while user data is loading to avoid false "not admin" flash
  .centered.q-gutter-lg.q-ma-md(v-if="$userAuth.loggedIn && !$userAuth.userData")
    q-spinner(size="40px" color="primary")
    h6.q-mt-sm Loading admin data…
  .centered.q-gutter-lg.q-ma-md(v-if="!$userAuth.loggedIn || !$userAuth.userData?.admin")
    h2 You need to be logged in as an admin to view this page





// Fullscreen QR dialog
q-dialog(v-model="qrDialogOpen" maximized)
  q-card.q-dialog-plugin.qr-dialog-card
    .centered.full-width.q-pa-lg(style="min-height:100vh; min-height:100dvh; display:flex; flex-direction:column; justify-content:center; align-items:center;")
      h5.text-white.q-mb-md {{ qrTitle }}
      q-spinner(color="primary" size="120px" v-if="qrLoading || !qrDataUrl")
      q-img(
        v-if="qrDataUrl && !qrLoading"
        :src="qrDataUrl"
        style="width:min(92vw, 600px); height:auto;"
        no-spinner
      )
      .row.justify-center.q-gutter-sm.q-mt-lg
        q-btn(color="primary" icon="content_copy" label="Copy Link" @click="copyQrLink" rounded)
        q-btn(color="grey-7" icon="close" label="Close" @click="qrDialogOpen = false" flat rounded)

// Fullscreen Image Preview dialog
q-dialog(v-model="imgPreviewOpen" maximized)
  q-card.q-dialog-plugin.qr-dialog-card
    .centered.full-width.q-pa-lg(style="min-height:100vh; min-height:100dvh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#000;")
      img(v-if="imgPreviewSrc" :src="imgPreviewSrc" style="max-width:95vw; max-height:90vh; max-height:90dvh; object-fit:contain; display:block;")
      .row.justify-center.q-gutter-sm.q-mt-lg
        q-btn(color="grey-7" icon="close" label="Close" @click="imgPreviewOpen = false" flat rounded)
</template>

<script lang="ts">
import { PromoCode } from "lib/api"
import { jwt } from "lib/jwt"
import { avatarImg, s3Img } from "lib/netlifyImg"
import { longIdToShort, catchErr } from "lib/util"
import { copyToClipboard, Dialog, Notify } from "quasar"
import type { QTableColumn } from "quasar"
import { defineComponent, ref, computed, watch } from "vue"
import { useRouter, type RouteLocationRaw } from "vue-router"
import {
  promoCreatePromoCode,
  promoGetPromoCodes,
  promoDeletePromoCode,
  useAdminListUsers,
  useAdminBanUser,
  useAdminListPayments,
  adminListPayments,
  creationsDescribeUploadedImage,
  adminListUsers,
  adminDiscountCodesList,
  adminDiscountCodeCreate,
  adminDiscountCodeUpdate,
  adminDiscountCodeDelete,
  adminAffiliatePayoutUser,
  adminAffiliatePayoutReceipts,
  adminAffiliatePayoutDetailsForUser,
  adminAttributionGroups,
  AdminAttributionGroupsGroupBy,
  AdminAttributionGroupsOrderBy,
  AdminAttributionGroupsSortDir,
  type AdminListUsersSortBy,
  type AdminListUsersSortDir,
  type AdminListPaymentsMethod,
  type AdminListPaymentsParams,
  type AdminListPayments200ItemsItem,
  type AdminListUsersParams,
  type AdminListUsers200UsersItem,
} from "src/lib/orval"
import QRCode from "qrcode"
import axios from "axios"

type TablePagination = { sortBy: string; descending: boolean; page: number; rowsPerPage: number }
type OnRequestProps = { pagination: TablePagination }

import AdminStats from "components/admin/AdminStats.vue"
import EmailFunnelsTab from "components/admin/EmailFunnelsTab.vue"
import MotdTab from "components/admin/MotdTab.vue"
import UserAttributionsTab from "components/admin/UserAttributionsTab.vue"
import UserAttributionDetails from "components/dialogs/UserAttributionDetails.vue"

export default defineComponent({
  components: { AdminStats, EmailFunnelsTab, MotdTab, UserAttributionsTab },

  setup() {
    const router = useRouter()
    const userSearch = ref("")
    const includeBanned = ref(false)

    const usersPagination = ref({
      sortBy: "spentPoints",
      descending: true,
      page: 1,
      rowsPerPage: 25,
    })

    const limit = computed(() => {
      const rpp = usersPagination.value.rowsPerPage
      const desired = rpp === 0 ? 100 : rpp
      return Math.min(desired, 100)
    })
    const offset = computed(() => {
      const rpp = usersPagination.value.rowsPerPage
      const page = usersPagination.value.page
      if (rpp === 0) return 0
      return (page - 1) * rpp
    })

    const params = computed({
      get: () => {
        // Map UI sort to API-supported sort fields
        const apiSortable = new Set<AdminListUsersSortBy>(["lastActiveAt", "spentPoints", "availablePoints", "createdAt", "updatedAt"])
        const currentSort = usersPagination.value.sortBy || "spentPoints"
        const maybeSort = currentSort as AdminListUsersSortBy
        const sortBy = apiSortable.has(maybeSort) ? maybeSort : undefined
        const sortDir: AdminListUsersSortDir | undefined = sortBy ? (usersPagination.value.descending ? "desc" : "asc") : undefined

        return {
          limit: limit.value,
          offset: offset.value,
          search: userSearch.value?.trim() ? userSearch.value.trim() : undefined,
          includeBanned: includeBanned.value ? true : undefined,
          sortBy,
          sortDir,
        }
      },
      set: () => {
        // read-only interface; setter present to satisfy MaybeRef typing
      },
    })

    const usersQuery = useAdminListUsers(params)
    const usersRows = computed(() => {
      const rows = usersQuery.data?.value?.data?.users || []
      const sortBy = usersPagination.value.sortBy || "spentPoints"
      const apiSortable = new Set(["lastActiveAt", "spentPoints", "availablePoints", "createdAt", "updatedAt"]) as Set<string>
      // If server supports this sort, trust server order
      if (apiSortable.has(sortBy)) return rows

      // Otherwise, sort locally within the current page
      const desc = !!usersPagination.value.descending
      const isDate = sortBy === "lastActiveAt" || sortBy === "createdAt"
      const val = (row: any) => {
        switch (sortBy) {
          case "username":
            return row.profile?.username || ""
          case "email":
            return row.profile?.email || ""
          case "telegram":
            return row.profile?.telegramName || row.profile?.telegramId || ""
          case "availablePoints":
            return row.availablePoints ?? 0
          case "spentPoints":
            return row.spentPoints ?? 0
          case "images":
            return row.stats?.images ?? 0
          case "videos":
            return row.stats?.videos ?? 0
          case "imageRequests":
            return row.stats?.imageRequests ?? 0
          case "videoRequests":
            return row.stats?.videoRequests ?? 0
          case "imagePurchases":
            return row.stats?.imagePurchases ?? 0
          case "videoPurchases":
            return row.stats?.videoPurchases ?? 0
          case "wallets":
            return row.wallets?.length ?? 0
          case "banned":
            return row.banned ? 1 : 0
          case "admin":
            return row.admin ? 1 : 0
          case "lastActiveAt":
            return row.lastActiveAt || ""
          case "createdAt":
            return row.createdAt || ""
          default:
            return row[sortBy]
        }
      }
      return rows.slice().sort((a: any, b: any) => {
        const av = val(a)
        const bv = val(b)
        let cmp = 0
        if (isDate) cmp = new Date(av || 0).getTime() - new Date(bv || 0).getTime()
        else if (typeof av === "number" && typeof bv === "number") cmp = av - bv
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""))
        return desc ? -cmp : cmp
      })
    })
    const usersTotal = computed(() => usersQuery.data?.value?.data?.total || usersRows.value.length)
    const usersLoading = usersQuery.isLoading
    const usersFetching = usersQuery.isFetching
    const refetchUsers = () => usersQuery.refetch()
    const onUsersRequest = (props: OnRequestProps) => {
      usersPagination.value = props.pagination
      refetchUsers()
    }

    // Export users to CSV (respects current filters) and includes primary attribution source
    const usersExporting = ref(false)
    async function exportUsersCsv() {
      if (usersExporting.value) return
      usersExporting.value = true
      try {
        const curr = params.value as AdminListUsersParams
        const baseParams: AdminListUsersParams = {
          search: curr?.search,
          includeBanned: curr?.includeBanned,
          sortBy: curr?.sortBy,
          sortDir: curr?.sortDir,
        }

        const pageSize = 100
        let offsetAll = 0
        let total = 0
        const all: AdminListUsers200UsersItem[] = []

        for (;;) {
          const res = await adminListUsers({ ...baseParams, limit: pageSize, offset: offsetAll })
          const data = res?.data
          const users = Array.isArray(data?.users) ? data.users : []
          total = Number(data?.total || users.length || 0)
          all.push(...users)
          offsetAll += users.length
          if (users.length === 0 || all.length >= total) break
        }

        // Resolve primary attribution source per user with light concurrency
        const primarySourceCache: Record<string, string> = { ...attribSourceByUserId.value }
        const concurrency = 6
        let idx = 0

        const worker = async () => {
          while (idx < all.length) {
            const i = idx++
            const row = all[i]
            if (!row || !row.id || primarySourceCache[row.id]) continue
            const hints = collectUserAttribHints(row)
            let resolved: string | null = null
            for (const term of hints) {
              if (!term) continue
              try {
                const { data } = await adminAttributionGroups({
                  groupBy: AdminAttributionGroupsGroupBy.source,
                  search: term,
                  includeUnknown: true,
                  limit: 5,
                  offset: 0,
                  orderBy: AdminAttributionGroupsOrderBy.users,
                  sortDir: AdminAttributionGroupsSortDir.desc,
                })
                const items = Array.isArray(data?.items) ? data.items : []
                if (items.length > 0) {
                  const firstKnown = items.find((it) => typeof it?.key === "string" && (it.key as string).trim().length > 0)
                  const fallback = items[0]
                  resolved = (firstKnown?.key as string | null) || (fallback?.key as string | null) || resolved
                  if (resolved && resolved !== "-") break
                }
              } catch {
                // continue trying other terms
              }
            }
            primarySourceCache[row.id] = resolved || "-"
          }
        }
        const workers = Array.from({ length: concurrency }, () => worker())
        await Promise.all(workers)

        const headers = [
          "id",
          "username",
          "email",
          "telegramId",
          "telegramName",
          "createdAt",
          "updatedAt",
          "lastActiveAt",
          "admin",
          "banned",
          "availablePoints",
          "spentPoints",
          "images",
          "videos",
          "imageRequests",
          "videoRequests",
          "imagePurchases",
          "videoPurchases",
          "wallets",
          "attribSource",
        ] as const

        const rows = all.map((u) => ({
          id: u.id || "",
          username: u.profile?.username || "",
          email: u.profile?.email || "",
          telegramId: u.profile?.telegramId || "",
          telegramName: u.profile?.telegramName || "",
          createdAt: u.createdAt || "",
          updatedAt: u.updatedAt || "",
          lastActiveAt: u.lastActiveAt || "",
          admin: u.admin ? "true" : "false",
          banned: u.banned ? "true" : "false",
          availablePoints: u.availablePoints ?? "",
          spentPoints: u.spentPoints ?? "",
          images: u.stats?.images ?? "",
          videos: u.stats?.videos ?? "",
          imageRequests: u.stats?.imageRequests ?? "",
          videoRequests: u.stats?.videoRequests ?? "",
          imagePurchases: u.stats?.imagePurchases ?? "",
          videoPurchases: u.stats?.videoPurchases ?? "",
          wallets: Array.isArray(u.wallets) ? u.wallets.join(" ") : "",
          attribSource: primarySourceCache[u.id] || "-",
        }))

        const escapeCsv = (val: unknown): string => {
          const s = val == null ? "" : String(val)
          const needsQuotes = /[",\n]/.test(s)
          const escaped = s.replace(/"/g, '""')
          return needsQuotes ? `"${escaped}"` : escaped
        }

        let csv = headers.join(",") + "\n"
        for (const r of rows) {
          csv += headers.map((h) => escapeCsv((r as Record<string, unknown>)[h])).join(",") + "\n"
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        const ts = new Date()
        const fn = `users-${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}.csv`
        a.href = url
        a.download = fn
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        Notify.create({ message: `Exported ${rows.length.toLocaleString()} users`, color: "positive", icon: "file_download" })
      } catch (error) {
        console.warn("exportUsersCsv failed", error)
        catchErr(error)
        Notify.create({ message: "Export failed", color: "negative" })
      } finally {
        usersExporting.value = false
      }
    }
    // Basic attribution source per user (lazy cached)
    const attribSourceByUserId = ref<Record<string, string>>({})
    const attribLoading = ref<Record<string, boolean>>({})
    const attribSearchHints = ref<Record<string, string[]>>({})
    const canOpenAttrib = (userId: string) => {
      if (!userId) return false
      return attribLoading.value[userId] !== true
    }
    const attributionButtonTitle = (userId: string) => {
      if (!userId) return "No attribution data"
      if (attribLoading.value[userId]) return "Loading attribution…"
      const value = attribSourceByUserId.value[userId]
      if (!value || value === "-") return "View attribution details"
      return `Primary source: ${value}`
    }
    async function loadAttribForUser(userId: string, rawHints: string[] = []) {
      if (!userId) return
      if (attribLoading.value[userId]) return
      const { hints, added } = mergeAttribHints(userId, rawHints)
      const currentValue = attribSourceByUserId.value[userId]
      if (currentValue && currentValue !== "-") return
      if (currentValue === "-" && !added) return
      attribLoading.value[userId] = true
      try {
        let resolved: string | null = null
        for (const term of hints) {
          if (!term) continue
          try {
            const res = await adminAttributionGroups({
              groupBy: AdminAttributionGroupsGroupBy.source,
              search: term,
              includeUnknown: true,
              limit: 5,
              offset: 0,
              orderBy: AdminAttributionGroupsOrderBy.users,
              sortDir: AdminAttributionGroupsSortDir.desc,
            })
            const items = Array.isArray(res?.data?.items) ? res.data.items : []
            if (items.length > 0) {
              const firstKnown = items.find((it: any) => typeof it?.key === "string" && it.key.trim().length > 0)
              const fallback = items[0]
              resolved = (firstKnown?.key as any) || (fallback?.key as any) || resolved
              if (resolved && resolved !== "-") break
            }
          } catch (error) {
            // Ignore individual term failures and continue
          }
        }
        attribSourceByUserId.value[userId] = resolved || "-"
      } catch (error) {
        if (!attribSourceByUserId.value[userId]) attribSourceByUserId.value[userId] = "-"
      } finally {
        delete attribLoading.value[userId]
      }
    }
    // Prefetch for current page rows
    watch(
      usersRows,
      (rows) => {
        const list = Array.isArray(rows) ? rows.slice(0, 50) : []
        list.forEach((row: any) => {
          if (!row || typeof row?.id !== "string") return
          const hints = collectUserAttribHints(row)
          void loadAttribForUser(row.id, hints)
        })
      },
      { immediate: true },
    )
    watch([userSearch, includeBanned], () => {
      usersPagination.value.page = 1
      refetchUsers()
    })

    // Payments tab
    const paymentsUserId = ref("")
    const paymentsMethod = ref<string | null>(null)
    const paymentsStatus = ref<string | null>(null)
    const paymentsStart = ref<string | null>(null)
    const paymentsEnd = ref<string | null>(null)

    const paymentsPagination = ref({
      sortBy: "createdAt",
      descending: true,
      page: 1,
      rowsPerPage: 25,
    })

    const limit2 = computed(() => {
      const rpp = paymentsPagination.value.rowsPerPage
      const desired = rpp === 0 ? 100 : rpp
      return Math.min(desired, 100)
    })
    const offset2 = computed(() => {
      const rpp = paymentsPagination.value.rowsPerPage
      const page = paymentsPagination.value.page
      if (rpp === 0) return 0
      return (page - 1) * rpp
    })

    const paymentsParams = computed(() => ({
      limit: limit2.value,
      offset: offset2.value,
      userId: paymentsUserId.value?.trim() ? paymentsUserId.value.trim() : undefined,
      method: (paymentsMethod.value || undefined) as any,
      status: paymentsStatus.value || undefined,
      startDateTime: paymentsStart.value ? new Date(paymentsStart.value).toISOString() : undefined,
      endDateTime: paymentsEnd.value ? new Date(paymentsEnd.value).toISOString() : undefined,
    }))

    const paymentsQuery = useAdminListPayments(paymentsParams)
    const paymentsRows = computed(() => {
      const rows = paymentsQuery.data?.value?.data?.items || []
      const sortBy = paymentsPagination.value.sortBy || "createdAt"
      const desc = !!paymentsPagination.value.descending
      const isDate = sortBy === "createdAt" || sortBy === "updatedAt"
      const val = (row: any) => {
        switch (sortBy) {
          case "user":
            return row.user?.username || row.user?.email || row.user?.telegramName || row.user?.telegramId || row.user?.id || ""
          case "method":
            return row.method || ""
          case "status":
            return row.status || ""
          case "points":
            return row.points ?? 0
          case "amountUsd":
            return row.amountUsd ?? 0
          case "createdAt":
            return row.createdAt || ""
          case "updatedAt":
            return row.updatedAt || ""
          default:
            return row[sortBy]
        }
      }
      const sorted = rows.slice().sort((a: any, b: any) => {
        const av = val(a)
        const bv = val(b)
        let cmp = 0
        if (isDate) cmp = new Date(av || 0).getTime() - new Date(bv || 0).getTime()
        else if (typeof av === "number" && typeof bv === "number") cmp = av - bv
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""))
        return desc ? -cmp : cmp
      })
      return sorted.map((row: any) => ({
        ...row,
        discountInfo: paymentDiscountInfo(row),
      }))
    })
    const paymentsTotal = computed(() => paymentsQuery.data?.value?.data?.total || paymentsRows.value.length)
    const paymentsLoading = paymentsQuery.isLoading
    const paymentsFetching = paymentsQuery.isFetching
    const refetchPayments = () => paymentsQuery.refetch()
    const onPaymentsRequest = (props: OnRequestProps) => {
      paymentsPagination.value = props.pagination
      refetchPayments()
    }

    watch([paymentsUserId, paymentsMethod, paymentsStatus, paymentsStart, paymentsEnd], () => {
      paymentsPagination.value.page = 1
      refetchPayments()
    })

    const paymentsMethodOptions = computed(() => {
      const vals = new Set<string>()
      for (const r of paymentsRows.value) if (r?.method) vals.add(String(r.method))
      return Array.from(vals).sort()
    })
    const paymentsStatusOptions = computed(() => {
      const vals = new Set<string>()
      for (const r of paymentsRows.value) if (r?.status) vals.add(String(r.status))
      return Array.from(vals).sort()
    })
    watch(
      paymentsRows,
      (rows) => {
        const list = Array.isArray(rows) ? rows.slice(0, 50) : []
        list.forEach((row: any) => {
          const user = row?.user
          if (!user || typeof user?.id !== "string") return
          const hints = collectUserAttribHints(user)
          void loadAttribForUser(user.id, hints)
        })
      },
      { immediate: true },
    )

    // Export payments to CSV using adminListPayments (orval)
    const paymentsExporting = ref(false)
    async function exportPaymentsCsv() {
      if (paymentsExporting.value) return
      paymentsExporting.value = true
      try {
        const baseParams: AdminListPaymentsParams = {
          userId: paymentsUserId.value?.trim() ? paymentsUserId.value.trim() : undefined,
          method: (paymentsMethod.value || undefined) as AdminListPaymentsMethod | undefined,
          status: paymentsStatus.value || undefined,
          startDateTime: paymentsStart.value ? new Date(paymentsStart.value).toISOString() : undefined,
          endDateTime: paymentsEnd.value ? new Date(paymentsEnd.value).toISOString() : undefined,
        }

        const pageSize = 100
        let offset = 0
        let total = 0
        const all: AdminListPayments200ItemsItem[] = []

        for (;;) {
          const res = await adminListPayments({ ...baseParams, limit: pageSize, offset })
          const data = res?.data
          const items = Array.isArray(data?.items) ? data.items : []
          total = Number(data?.total || items.length || 0)
          all.push(...items)
          offset += items.length
          if (items.length === 0 || all.length >= total) break
        }

        const headers = [
          "createdAt",
          "updatedAt",
          "id",
          "method",
          "status",
          "amountUsd",
          "points",
          "discountCode",
          "discountPercent",
          "discountAmountUsd",
          "userId",
          "username",
          "email",
          "telegramId",
          "telegramName",
          "packagePoints",
          "packageUsd",
          "packageDiscountPct",
          "orderID",
          "transactionId",
          "currency",
          "chainName",
          "tokenType",
          "tokenAmount",
          "stars",
          "destWallet",
          "senderWallet",
          "memo",
        ] as const

        const rows = all.map((row) => {
          const discount = paymentDiscountInfo(row as any)
          return {
            createdAt: row.createdAt || "",
            updatedAt: row.updatedAt || "",
            id: row.id || "",
            method: row.method || "",
            status: row.status || "",
            amountUsd: row.amountUsd ?? "",
            points: row.points ?? "",
            discountCode: row.discountCode ?? discount?.code ?? "",
            discountPercent: discount?.percent ?? "",
            discountAmountUsd: discount?.amountUsd ?? "",
            userId: row.user?.id || "",
            username: row.user?.username || "",
            email: row.user?.email || "",
            telegramId: row.user?.telegramId || "",
            telegramName: row.user?.telegramName || "",
            packagePoints: row.package?.points ?? "",
            packageUsd: row.package?.usd ?? "",
            packageDiscountPct: row.package?.discountPct ?? "",
            orderID: row.details?.orderID || "",
            transactionId: row.details?.transactionId || "",
            currency: row.details?.currency || "",
            chainName: row.details?.chainName || "",
            tokenType: row.details?.tokenType || "",
            tokenAmount: row.details?.tokenAmount ?? "",
            stars: row.details?.stars ?? "",
            destWallet: row.details?.destWallet || "",
            senderWallet: row.details?.senderWallet || "",
            memo: row.details?.memo || "",
          }
        })

        const escapeCsv = (val: unknown): string => {
          const s = val == null ? "" : String(val)
          const needsQuotes = /[",\n]/.test(s)
          const escaped = s.replace(/"/g, '""')
          return needsQuotes ? `"${escaped}"` : escaped
        }

        let csv = headers.join(",") + "\n"
        for (const r of rows) {
          csv += headers.map((h) => escapeCsv((r as any)[h])).join(",") + "\n"
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        const ts = new Date()
        const fn = `payments-${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}.csv`
        a.href = url
        a.download = fn
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        Notify.create({ message: `Exported ${rows.length.toLocaleString()} payments`, color: "positive", icon: "file_download" })
      } catch (error) {
        console.warn("exportPaymentsCsv failed", error)
        catchErr(error)
        Notify.create({ message: "Export failed", color: "negative" })
      } finally {
        paymentsExporting.value = false
      }
    }

    function mergeAttribHints(userId: string, extraHints: string[] = []): { hints: string[]; added: boolean } {
      const current = attribSearchHints.value[userId] || []
      const currentSet = new Set(current)
      const combined = new Set(current)
      emitSearchVariants(userId).forEach((variant) => combined.add(variant))
      extraHints.forEach((hint) => {
        emitSearchVariants(hint).forEach((variant) => combined.add(variant))
      })
      const hints = Array.from(combined).filter((value) => typeof value === "string" && value.trim().length > 0)
      const added = hints.length > currentSet.size
      attribSearchHints.value[userId] = hints
      return { hints, added }
    }

    function emitSearchVariants(value: unknown): string[] {
      if (typeof value !== "string") return []
      const trimmed = value.trim()
      if (!trimmed) return []
      const variants = new Set<string>()
      variants.add(trimmed)
      const lower = trimmed.toLowerCase()
      variants.add(lower)
      if (trimmed.startsWith("@")) {
        const without = trimmed.slice(1)
        if (without) {
          variants.add(without)
          variants.add(without.toLowerCase())
        }
      } else if (/^[\w.-]{3,}$/i.test(trimmed) && !trimmed.includes("@") && !trimmed.includes(" ")) {
        variants.add(`@${trimmed}`)
        variants.add(`@${trimmed.toLowerCase()}`)
      }
      return Array.from(variants).filter((entry) => entry.trim().length > 0)
    }

    function collectUserAttribHints(user: any): string[] {
      if (!user || typeof user !== "object") return []
      const hints = new Set<string>()
      const push = (value: unknown) => {
        if (typeof value !== "string") return
        emitSearchVariants(value).forEach((variant) => hints.add(variant))
      }
      push(user?.id)
      push(user?.userId)
      const directKeys = ["username", "userName", "handle", "displayName", "email", "source", "utmSource", "utmMedium", "utmCampaign", "referrer", "referrerDomain", "landingDomain"]
      directKeys.forEach((key) => push((user as any)?.[key]))
      const profile = user?.profile
      if (profile && typeof profile === "object") {
        Object.values(profile).forEach((val) => push(val))
      }
      if (Array.isArray((user as any)?.emails)) {
        ;(user as any).emails.forEach((val: unknown) => push(val))
      }
      if (Array.isArray((user as any)?.identities)) {
        ;(user as any).identities.forEach((entry: any) => {
          if (typeof entry === "string") push(entry)
          else if (entry && typeof entry === "object") Object.values(entry).forEach((val) => push(val))
        })
      }
      return Array.from(hints)
    }

    const labelById = (id?: string | null) => {
      const key = typeof id === "string" ? id : ""
      if (!key) return ""
      return userLabelById.value[key] || key
    }

    const statusColor = (status: string) => {
      if (!status) return "grey-6"
      const s = status.toLowerCase()
      if (s.includes("fail") || s.includes("declin") || s.includes("error")) return "negative"
      if (s.includes("pend") || s.includes("incom")) return "warning"
      if (s.includes("succe") || s.includes("complet") || s.includes("paid")) return "positive"
      return "grey-6"
    }

    const profileLinkForUsername = (username?: string | null) => {
      if (!username) return ""
      try {
        return router.resolve({ name: "profile", params: { username } }).href
      } catch {
        return ""
      }
    }

    const profileLinkForUser = (user: any) => {
      if (!user) return ""
      const username = user?.username || user?.profile?.username || user?.userName || user?.originUsername || user?.creatorUsername || undefined
      return profileLinkForUsername(typeof username === "string" ? username : undefined)
    }

    const userDisplay = (user: any) => user?.username || user?.email || user?.telegramName || user?.telegramId || user?.id || "-"

    const normalizeDiscountPercent = (raw: unknown): number | null => {
      if (raw == null) return null
      const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : Number.NaN
      if (!Number.isFinite(value) || value <= 0) return null
      const percent = value <= 1 ? value * 100 : value
      return Math.round(percent * 100) / 100
    }

    const normalizeDiscountAmount = (raw: unknown): number | null => {
      if (raw == null) return null
      const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : Number.NaN
      if (!Number.isFinite(value) || Math.abs(value) <= 0) return null
      return Math.round(Math.abs(value) * 100) / 100
    }

    const paymentDiscountInfo = (row: any): { code?: string; percent?: number; amountUsd?: number } | null => {
      if (!row) return null

      const details = row.details || {}
      const pkg = row.package || {}

      const possibleCodes = [row.discountCode, details.discountCode, details.discount_code, details.discountcode]
      const discountCode = possibleCodes.map((code: unknown) => (typeof code === "string" ? code.trim() : "")).find((code) => !!code)

      const discountPctRaw = row.discountPct ?? details.discountPct ?? details.discount_pct ?? details.discountPercent ?? details.discount_percent ?? pkg.discountPct ?? pkg.discount_pct

      const percent = normalizeDiscountPercent(discountPctRaw)

      const discountAmountRaw = row.discountAmount ?? row.discountUsd ?? details.discountAmount ?? details.discount_amount ?? details.discountUsd ?? details.discount_usd

      const amountUsd = normalizeDiscountAmount(discountAmountRaw)

      if (!discountCode && percent == null && amountUsd == null) return null

      return {
        code: discountCode || undefined,
        percent: percent ?? undefined,
        amountUsd: amountUsd ?? undefined,
      }
    }

    const formatDiscountPercent = (pct: number) => {
      if (!Number.isFinite(pct)) return ""
      const rounded = Math.abs(pct)
      return rounded % 1 === 0 ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(2)}%`
    }

    const formatDiscountAmount = (amount: number) => {
      if (!Number.isFinite(amount)) return ""
      return `$${Math.abs(amount).toFixed(2)}`
    }

    const paymentsColumns: QTableColumn<any>[] = [
      { name: "createdAt", label: "Date", field: "createdAt", sortable: true, format: (val: string) => (val ? new Date(val).toLocaleString() : "") },
      { name: "user", label: "User", field: (row: any) => row.user?.username || row.user?.email || row.user?.telegramName || row.user?.telegramId || row.user?.id || "-", sortable: true },
      { name: "attribution", label: "Attrib", field: (row: any) => row?.user?.id || "", sortable: false },
      { name: "method", label: "Method", field: "method", sortable: true },
      { name: "status", label: "Status", field: "status", sortable: true },
      { name: "points", label: "Points", field: "points", align: "right", sortable: true, format: (val: number) => (val ?? 0).toLocaleString() },
      { name: "amountUsd", label: "USD", field: "amountUsd", align: "right", sortable: true, format: (val: number) => (val != null ? `$${val.toFixed(2)}` : "") },
      { name: "discount", label: "Discount", field: (row: any) => row, sortable: false },
      { name: "package", label: "Package", field: (row: any) => row.package, sortable: false },
      { name: "details", label: "Details", field: (row: any) => row.details, sortable: false },
      { name: "updatedAt", label: "Updated", field: "updatedAt", sortable: true, format: (val: string) => (val ? new Date(val).toLocaleString() : "") },
    ]

    const banMutation = useAdminBanUser()
    const confirmBan = (row: any) => {
      if (row.banned) return
      Dialog.create({
        title: "Ban user",
        message: `Enter a reason for banning ${row.profile?.username || row.id}`,
        prompt: { model: "", isValid: (val) => val.length >= 0, type: "text" },
        cancel: true,
        ok: { label: "Ban", color: "negative" },
      }).onOk(async (reason) => {
        try {
          await banMutation.mutateAsync({ data: { userId: row.id, reason } })
          Notify.create({ message: "User banned", color: "negative", icon: "block" })
          await usersQuery.refetch()
        } catch (error) {
          catchErr(error)
        }
      })
    }

    const userColumns: QTableColumn<any>[] = [
      { name: "actions", label: "Actions", field: "id", align: "left", sortable: false },
      { name: "username", label: "Username", field: (row: any) => row.profile?.username || "", sortable: true },
      { name: "email", label: "Email", field: (row: any) => row.profile?.email || "", sortable: true, classes: "no-wrap" },
      { name: "telegram", label: "Telegram", field: (row: any) => row.profile?.telegramName || row.profile?.telegramId || "", sortable: true, classes: "no-wrap" },
      { name: "attribution", label: "Attrib", field: "id", sortable: false },
      { name: "availablePoints", label: "Avail", field: "availablePoints", align: "right", sortable: true, format: (val: number) => (val ?? 0).toLocaleString() },
      { name: "spentPoints", label: "Spent", field: "spentPoints", align: "right", sortable: true, format: (val: number) => (val ?? 0).toLocaleString() },
      { name: "images", label: "Images", field: (row: any) => row.stats?.images || 0, align: "right", sortable: true },
      { name: "videos", label: "Videos", field: (row: any) => row.stats?.videos || 0, align: "right", sortable: true },
      { name: "imageRequests", label: "Img Req", field: (row: any) => row.stats?.imageRequests || 0, align: "right", sortable: true },
      { name: "videoRequests", label: "Vid Req", field: (row: any) => row.stats?.videoRequests || 0, align: "right", sortable: true },
      { name: "imagePurchases", label: "Img Purch", field: (row: any) => row.stats?.imagePurchases || 0, align: "right", sortable: true },
      { name: "videoPurchases", label: "Vid Purch", field: (row: any) => row.stats?.videoPurchases || 0, align: "right", sortable: true },
      { name: "wallets", label: "Wallets", field: (row: any) => row.wallets?.length || 0, align: "right", sortable: true },
      { name: "lastActiveAt", label: "Last Active", field: "lastActiveAt", sortable: true, format: (val: string) => (val ? new Date(val).toLocaleString() : "") },
      { name: "createdAt", label: "Created", field: "createdAt", sortable: true, format: (val: string) => (val ? new Date(val).toLocaleDateString() : "") },
      { name: "banned", label: "Banned", field: "banned", sortable: true },
      { name: "admin", label: "Admin", field: "admin", sortable: true },
    ]

    // Uploaded Images state
    const uploadsAccount = ref("")
    const uploadsView = ref<"table" | "grid">("grid")
    const topPager = ref<HTMLElement | null>(null)
    const uploadsViewOptions = [
      { label: "Table", value: "table", icon: "table_rows" },
      { label: "Grid", value: "grid", icon: "grid_on" },
    ]
    const uploadsStart = ref<string | null>(null)
    const uploadsEnd = ref<string | null>(null)
    const uploadsPagination = ref({
      sortBy: "createdAt",
      descending: true,
      page: 1,
      rowsPerPage: 25,
    })
    const uploadsLoading = ref(false)
    const uploadsFetching = ref(false)
    const uploadsRows = ref<any[]>([])
    const uploadsTotal = ref(0)

    const limit3 = computed(() => {
      const rpp = uploadsPagination.value.rowsPerPage
      const desired = rpp === 0 ? 100 : rpp
      return Math.min(desired, 100)
    })
    const offset3 = computed(() => {
      const rpp = uploadsPagination.value.rowsPerPage
      const page = uploadsPagination.value.page
      if (rpp === 0) return 0
      return (page - 1) * rpp
    })

    const uploadsColumns: QTableColumn<any>[] = [
      { name: "actions", label: "Actions", field: "id", align: "left", sortable: false },
      { name: "preview", label: "Preview", field: "id", align: "left", sortable: false },
      { name: "user", label: "User", field: (row: any) => row.user || {}, sortable: true },
      { name: "id", label: "Image ID", field: "id", sortable: false },
      { name: "createdAt", label: "Created", field: "createdAt", sortable: true },
    ]

    async function fetchUploads(initial = false) {
      try {
        if (initial) uploadsLoading.value = true
        else uploadsFetching.value = true
        const buildParams = (limitVal: number, offsetVal: number) => {
          const params: any = {
            limit: limitVal,
            offset: offsetVal,
            order: uploadsPagination.value.descending ? "desc" : "asc",
          }
          if (uploadsAccount.value?.trim()) params.account = uploadsAccount.value.trim()
          if (uploadsStart.value) params.startDateTime = new Date(uploadsStart.value).toISOString()
          if (uploadsEnd.value) params.endDateTime = new Date(uploadsEnd.value).toISOString()
          return params
        }

        const chunk = 100
        const wantAll = uploadsPagination.value.rowsPerPage === 0
        const allItems: any[] = []

        if (wantAll) {
          let offset = 0
          let total = 0
          for (;;) {
            const params = buildParams(chunk, offset)
            // Prefer orval admin endpoint if available, fallback to raw axios
            let data: any
            try {
              const mod: any = await import("src/lib/orval")
              if (typeof mod.adminListUploadedImages === "function") {
                const res = await mod.adminListUploadedImages(params)
                data = res?.data
              } else {
                const res = await axios.get("/admin/listUploadedImages", { params })
                data = res.data
              }
            } catch {
              const res = await axios.get("/admin/listUploadedImages", { params })
              data = res.data
            }
            const items = Array.isArray(data?.items) ? data.items : []
            total = Number(data?.total || total || 0)
            allItems.push(...items)
            if (items.length < chunk || allItems.length >= total) break
            offset += items.length
          }
          uploadsRows.value = allItems.map((it: any) => ({
            id: it.id || it.imageId || it._id,
            createdAt: it.createdAt || it.created_at || null,
            user: it.user || { id: it.userId, username: it.username, email: it.email, telegramName: it.telegramName },
          }))
          uploadsTotal.value = allItems.length
        } else {
          const params = buildParams(limit3.value, offset3.value)
          // Prefer orval admin endpoint if available, fallback to raw axios
          let data: any
          try {
            const mod: any = await import("src/lib/orval")
            if (typeof mod.adminListUploadedImages === "function") {
              const res = await mod.adminListUploadedImages(params)
              data = res?.data
            } else {
              const res = await axios.get("/admin/listUploadedImages", { params })
              data = res.data
            }
          } catch {
            const res = await axios.get("/admin/listUploadedImages", { params })
            data = res.data
          }
          const items = Array.isArray(data?.items) ? data.items : []
          uploadsRows.value = items.map((it: any) => ({
            id: it.id || it.imageId || it._id,
            createdAt: it.createdAt || it.created_at || null,
            user: it.user || { id: it.userId, username: it.username, email: it.email, telegramName: it.telegramName },
          }))
          uploadsTotal.value = Number(data?.total || uploadsRows.value.length || 0)
        }
      } finally {
        uploadsLoading.value = false
        uploadsFetching.value = false
      }
    }

    const refetchUploads = () => fetchUploads(false)
    const uploadsSilent = ref(false)
    const onUploadsRequest = (props: OnRequestProps) => {
      uploadsSilent.value = true
      uploadsPagination.value = props.pagination
      void refetchUploads()
      uploadsSilent.value = false
    }
    watch([uploadsAccount, uploadsStart, uploadsEnd], () => {
      uploadsPagination.value.page = 1
      void refetchUploads()
    })
    // React to external page/rows changes (top/bottom paginators and rows selector)
    watch(
      () => [uploadsPagination.value.page, uploadsPagination.value.rowsPerPage],
      () => {
        if (uploadsSilent.value) return
        void refetchUploads()
      },
    )
    watch(
      () => uploadsPagination.value.rowsPerPage,
      () => {
        uploadsPagination.value.page = 1
      },
    )

    const uploadsAccountIdentifier = (user: any) => {
      if (!user) return ""
      return user?.username || user?.profile?.username || user?.email || user?.profile?.email || user?.telegramName || user?.telegramId || user?.id || ""
    }

    const filterUploadsByUser = (user: any) => {
      const identifier = uploadsAccountIdentifier(user)
      if (!identifier) return
      uploadsAccount.value = identifier
      if (uploadsPagination.value.page !== 1) uploadsPagination.value.page = 1
    }

    function scrollTopPagerIntoView() {
      try {
        const el = topPager.value
        if (!el || typeof window === "undefined") return
        const rect = el.getBoundingClientRect()
        const top = window.pageYOffset + rect.top - 8
        window.scrollTo({ top, behavior: "smooth" })
      } catch {}
    }

    function onBottomPageChange() {
      // v-model already updated uploadsPagination.page; just scroll the top pager into view
      scrollTopPagerIntoView()
    }

    // Identify if results correspond to a single uploader for top ban button
    const singleUploaderUser = computed(() => {
      const ids = new Set<string>()
      for (const r of uploadsRows.value) if (r?.user?.id) ids.add(String(r.user.id))
      if (ids.size !== 1) return null
      const onlyId = Array.from(ids)[0]!
      // Try to build a minimal display object for button
      const sample = uploadsRows.value.find((r) => r?.user?.id === onlyId)
      return sample?.user || { id: onlyId }
    })

    const uploadsProfileLink = computed(() => {
      const user = singleUploaderUser.value
      if (!user) return ""
      return profileLinkForUser(user)
    })

    const uploadsProfileLabel = computed(() => {
      const user = singleUploaderUser.value
      if (!user) return ""
      const username = user?.username || user?.profile?.username || user?.userName
      if (username) return `Open @${username}`
      return "Open profile"
    })

    async function banTopUser() {
      // Prefer explicit filter value to lookup user; fallback to inferred single user
      const search = uploadsAccount.value?.trim() || (singleUploaderUser.value?.id as string | undefined)
      if (!search) return
      try {
        const res = await adminListUsers({ search, limit: 1, offset: 0 })
        const row = res?.data?.users?.[0]
        if (row) return confirmBan(row)
      } catch {}
      // fallback minimal row
      const fallbackRow = singleUploaderUser.value ? { id: singleUploaderUser.value.id, profile: { username: singleUploaderUser.value.username }, banned: false } : { id: search, profile: { username: search }, banned: false }
      confirmBan(fallbackRow as any)
    }

    // Training Set Images state and actions
    const tsetsAccount = ref("")
    const tsetsView = ref<"table" | "grid">("grid")
    const tsetsTopPager = ref<HTMLElement | null>(null)
    const tsetsStart = ref<string | null>(null)
    const tsetsEnd = ref<string | null>(null)
    const tsetsPagination = ref({
      sortBy: "createdAt",
      descending: true,
      page: 1,
      rowsPerPage: 25,
    })
    const tsetsLoading = ref(false)
    const tsetsFetching = ref(false)
    const tsetsRows = ref<any[]>([])
    const tsetsTotal = ref(0)

    const tsetsLimit = computed(() => {
      const rpp = tsetsPagination.value.rowsPerPage
      const desired = rpp === 0 ? 100 : rpp
      return Math.min(desired, 100)
    })
    const tsetsOffset = computed(() => {
      const rpp = tsetsPagination.value.rowsPerPage
      const page = tsetsPagination.value.page
      if (rpp === 0) return 0
      return (page - 1) * rpp
    })

    const tsetsColumns: QTableColumn<any>[] = [
      { name: "actions", label: "Actions", field: "trainingSetId", align: "left", sortable: false },
      { name: "preview", label: "Preview", field: "url", align: "left", sortable: false },
      { name: "user", label: "User", field: (row: any) => row.user || {}, sortable: true },
      { name: "trainingSetId", label: "Training Set ID", field: "trainingSetId", sortable: false },
      { name: "createdAt", label: "Created", field: "createdAt", sortable: true },
    ]

    async function fetchTsets(initial = false) {
      try {
        if (initial) tsetsLoading.value = true
        else tsetsFetching.value = true
        const buildParams = (limitVal: number, offsetVal: number) => {
          const params: any = {
            limit: limitVal,
            offset: offsetVal,
            order: tsetsPagination.value.descending ? "desc" : "asc",
          }
          if (tsetsAccount.value?.trim()) params.account = tsetsAccount.value.trim()
          if (tsetsStart.value) params.startDateTime = new Date(tsetsStart.value).toISOString()
          if (tsetsEnd.value) params.endDateTime = new Date(tsetsEnd.value).toISOString()
          return params
        }

        const chunk = 100
        const wantAll = tsetsPagination.value.rowsPerPage === 0
        const allItems: any[] = []

        if (wantAll) {
          let offset = 0
          let total = 0
          for (;;) {
            const params = buildParams(chunk, offset)
            let data: any
            try {
              const mod: any = await import("src/lib/orval")
              if (typeof mod.adminListTrainingSetThumbnails === "function") {
                const res = await mod.adminListTrainingSetThumbnails(params)
                data = res?.data
              } else {
                const res = await axios.get("/admin/listTrainingSetThumbnails", { params })
                data = res.data
              }
            } catch {
              const res = await axios.get("/admin/listTrainingSetThumbnails", { params })
              data = res.data
            }
            const items = Array.isArray(data?.items) ? data.items : []
            total = Number(data?.total || total || 0)
            allItems.push(...items)
            if (items.length < chunk || allItems.length >= total) break
            offset += items.length
          }
          tsetsRows.value = allItems.map((it: any) => ({
            thumbnailId: it.thumbnailId || it.id || it._id,
            trainingSetId: it.trainingSetId,
            createdAt: it.createdAt || it.created_at || null,
            url: it.url,
            user: it.user || { id: it.userId, username: it.username, email: it.email, telegramName: it.telegramName },
          }))
          tsetsTotal.value = allItems.length
        } else {
          const params = buildParams(tsetsLimit.value, tsetsOffset.value)
          let data: any
          try {
            const mod: any = await import("src/lib/orval")
            if (typeof mod.adminListTrainingSetThumbnails === "function") {
              const res = await mod.adminListTrainingSetThumbnails(params)
              data = res?.data
            } else {
              const res = await axios.get("/admin/listTrainingSetThumbnails", { params })
              data = res.data
            }
          } catch {
            const res = await axios.get("/admin/listTrainingSetThumbnails", { params })
            data = res.data
          }
          const items = Array.isArray(data?.items) ? data.items : []
          tsetsRows.value = items.map((it: any) => ({
            thumbnailId: it.thumbnailId || it.id || it._id,
            trainingSetId: it.trainingSetId,
            createdAt: it.createdAt || it.created_at || null,
            url: it.url,
            user: it.user || { id: it.userId, username: it.username, email: it.email, telegramName: it.telegramName },
          }))
          tsetsTotal.value = Number(data?.total || tsetsRows.value.length || 0)
        }
      } finally {
        tsetsLoading.value = false
        tsetsFetching.value = false
      }
    }

    const refetchTsets = () => fetchTsets(false)
    const tsetsSilent = ref(false)
    const onTsetsRequest = (props: OnRequestProps) => {
      tsetsSilent.value = true
      tsetsPagination.value = props.pagination
      void refetchTsets()
      tsetsSilent.value = false
    }
    watch([tsetsAccount, tsetsStart, tsetsEnd], () => {
      tsetsPagination.value.page = 1
      void refetchTsets()
    })
    watch(
      () => [tsetsPagination.value.page, tsetsPagination.value.rowsPerPage],
      () => {
        if (tsetsSilent.value) return
        void refetchTsets()
      },
    )
    watch(
      () => tsetsPagination.value.rowsPerPage,
      () => {
        tsetsPagination.value.page = 1
      },
    )

    const tsetsAccountIdentifier = (user: any) => {
      if (!user) return ""
      return user?.username || user?.profile?.username || user?.email || user?.profile?.email || user?.telegramName || user?.telegramId || user?.id || ""
    }

    const filterTsetsByUser = (user: any) => {
      const identifier = tsetsAccountIdentifier(user)
      if (!identifier) return
      tsetsAccount.value = identifier
      if (tsetsPagination.value.page !== 1) tsetsPagination.value.page = 1
    }

    function scrollTopPagerIntoViewTsets() {
      try {
        const el = tsetsTopPager.value
        if (!el || typeof window === "undefined") return
        const rect = el.getBoundingClientRect()
        const top = window.pageYOffset + rect.top - 8
        window.scrollTo({ top, behavior: "smooth" })
      } catch {}
    }

    function onBottomPageChangeTsets() {
      scrollTopPagerIntoViewTsets()
    }

    const tsetsSingleUser = computed(() => {
      const ids = new Set<string>()
      for (const r of tsetsRows.value) if (r?.user?.id) ids.add(String(r.user.id))
      if (ids.size !== 1) return null
      const onlyId = Array.from(ids)[0]!
      const sample = tsetsRows.value.find((r) => r?.user?.id === onlyId)
      return sample?.user || { id: onlyId }
    })

    const tsetsProfileLink = computed(() => {
      const user = tsetsSingleUser.value
      if (!user) return ""
      return profileLinkForUser(user)
    })

    const tsetsProfileLabel = computed(() => {
      const user = tsetsSingleUser.value
      if (!user) return ""
      const username = user?.username || user?.profile?.username || user?.userName
      if (username) return `Open @${username}`
      return "Open profile"
    })

    async function banTopUserTsets() {
      const search = tsetsAccount.value?.trim() || (tsetsSingleUser.value?.id as string | undefined)
      if (!search) return
      try {
        const res = await adminListUsers({ search, limit: 1, offset: 0 })
        const row = res?.data?.users?.[0]
        if (row) return confirmBan(row)
      } catch {}
      const fallbackRow = tsetsSingleUser.value ? { id: tsetsSingleUser.value.id, profile: { username: tsetsSingleUser.value.username }, banned: false } : { id: search, profile: { username: search }, banned: false }
      confirmBan(fallbackRow as any)
    }

    async function lookupUploaderTsets(row: any) {
      try {
        const uid = row?.user?.id
        if (!uid) return
        const res = await adminListUsers({ search: uid, limit: 1, offset: 0 })
        const user = res?.data?.users?.[0]
        if (!user) return
        Dialog.create({
          title: "Uploader",
          message: `User: ${userDisplay({ username: user.profile?.username, email: user.profile?.email, telegramName: user.profile?.telegramName, id: user.id })}`,
          cancel: true,
          ok: { label: "Ban", color: "negative" },
          options: { type: "checkbox", model: [], items: [] },
        }).onOk(() => confirmBan(user))
      } catch (error) {
        catchErr(error)
      }
    }

    async function banUploaderTsets(row: any) {
      try {
        const uid = row?.user?.id
        if (!uid) return
        try {
          const res = await adminListUsers({ search: uid, limit: 1, offset: 0 })
          const user = res?.data?.users?.[0]
          if (user) return confirmBan(user)
        } catch {}
        const fallbackRow = { id: uid, profile: { username: userDisplay(row.user) }, banned: false }
        confirmBan(fallbackRow as any)
      } catch (error) {
        catchErr(error)
      }
    }

    // Discount Codes state and actions
    const dcRows = ref<any[]>([])
    const dcLoading = ref(false)
    const dcFetching = ref(false)
    const userLabelById = ref<Record<string, string>>({})
    const userUsernameById = ref<Record<string, string>>({})
    const payoutDetailsByUserId = ref<Record<string, { paypalEmail: string | null; totalPaid: number }>>({})
    const profileLinkByUserId = (userId?: string | null) => {
      if (!userId) return ""
      return profileLinkForUsername(userUsernameById.value[userId])
    }
    const dcColumns: QTableColumn<any>[] = [
      { name: "actions", label: "Actions", field: "code", align: "left", sortable: false },
      { name: "code", label: "Code", field: "code", sortable: true },
      { name: "discount", label: "Discount", field: "discount", sortable: true },
      { name: "uses", label: "Uses", field: (row: any) => `${row.used}/${row.maximumUses}`, sortable: true },
      { name: "linkedUser", label: "Linked User", field: (row: any) => (row.linkedUserId ? userLabelById.value[row.linkedUserId] || row.linkedUserId : ""), sortable: true },
      { name: "pendingPayout", label: "Pending", field: (row: any) => (row as any).pendingPayout || 0, align: "right", sortable: true, format: (val: number) => `$${(val || 0).toFixed(2)}` },
      { name: "totalPayout", label: "Total Paid", field: (row: any) => (row as any).totalPayout || 0, align: "right", sortable: true, format: (val: number) => `$${(val || 0).toFixed(2)}` },
      { name: "createdAt", label: "Created", field: "createdAt", sortable: true },
    ]

    const dcForm = ref({
      code: "",
      discountPct: 10,
      maximumUses: 100,
      linkedUserId: "" as string | null | undefined,
    })

    async function fetchDiscounts(initial = false) {
      try {
        if (initial) dcLoading.value = true
        else dcFetching.value = true
        const res = await adminDiscountCodesList()
        const raw = Array.isArray(res?.data) ? res.data : []
        // Normalize fields for UI: keep legacy names used by the table template
        dcRows.value = raw.map((r: any) => ({
          ...r,
          pendingPayout: Number(r?.affiliatePayoutPending || 0),
          totalPayout: Number(r?.affiliatePaid || 0),
        }))
        const ids = Array.from(new Set(dcRows.value.map((r: any) => r?.linkedUserId).filter((v: any) => typeof v === "string" && v))) as string[]
        await ensureUserLabels(ids)
        await ensurePayoutDetails(ids, true)
      } catch (e) {
        // show a toast
        Notify.create({ type: "negative", message: "Failed to load discount codes" })
      } finally {
        dcLoading.value = false
        dcFetching.value = false
      }
    }
    const refetchDiscounts = () => fetchDiscounts(false)

    const dcCreating = ref(false)
    async function createDiscountCode() {
      try {
        if (!dcForm.value.code) {
          Notify.create({ type: "warning", message: "Code is required" })
          return
        }
        dcCreating.value = true
        const discount = Math.max(0, Math.min(95, Number(dcForm.value.discountPct || 0))) / 100
        await adminDiscountCodeCreate({
          code: (dcForm.value.code || "").toUpperCase().trim(),
          discount,
          maximumUses: Math.max(1, Number(dcForm.value.maximumUses || 1)),
          linkedUserId: typeof dcForm.value.linkedUserId === "string" && dcForm.value.linkedUserId.trim() ? dcForm.value.linkedUserId.trim() : null,
        })
        Notify.create({ type: "positive", message: "Discount code created" })
        await refetchDiscounts()
      } catch (error) {
        catchErr(error)
      } finally {
        dcCreating.value = false
      }
    }

    // Aggregate pending payouts by user from discount codes
    const pendingPayoutRows = computed(() => {
      const byUser = new Map<string, number>()
      for (const r of dcRows.value) {
        const uid = r?.linkedUserId
        const pending = Number((r as any)?.pendingPayout || 0)
        if (!uid || pending <= 0) continue
        byUser.set(uid, (byUser.get(uid) || 0) + pending)
      }
      const rows = Array.from(byUser.entries()).map(([userId, pending]) => ({ userId, pending }))
      // Sort by pending desc
      rows.sort((a, b) => b.pending - a.pending)
      return rows
    })
    const pendingPayoutColumns: QTableColumn<any>[] = [
      { name: "user", label: "User", field: "user", sortable: true },
      { name: "paypalEmail", label: "PayPal Email", field: "userId", sortable: false },
      { name: "pending", label: "Pending", field: "pending", align: "right", sortable: true, format: (val: number) => `$${(val || 0).toFixed(2)}` },
      { name: "actions", label: "Actions", field: "userId", sortable: false },
    ]

    function confirmAffiliatePayout(userId: string, amount: number) {
      Dialog.create({
        title: "Confirm Payout",
        message: `Payout $${(amount || 0).toFixed(2)} to ${userLabelById.value[userId] || userId}?`,
        cancel: true,
        ok: { label: "Payout", color: "primary" },
      }).onOk(async () => {
        try {
          await adminAffiliatePayoutUser({ userId })
          Notify.create({ type: "positive", message: "Payout executed" })
          await refetchDiscounts()
          await refetchAffiliateReceipts()
        } catch (e) {
          catchErr(e)
        }
      })
    }

    // Admin payout receipts (review)
    const apReceipts = ref<any[]>([])
    const apLoading = ref(false)
    const apColumns: QTableColumn<any>[] = [
      { name: "payoutDate", label: "Date", field: "payoutDate", sortable: true },
      { name: "user", label: "User", field: "user", sortable: false },
      { name: "paypalEmail", label: "PayPal Email", field: "paypalEmail", sortable: false },
      { name: "amount", label: "Amount", field: "amount", align: "right", sortable: true, format: (val: number) => `$${(val || 0).toFixed(2)}` },
    ]

    async function ensureUserLabels(ids: string[]) {
      const unique = Array.from(new Set(ids.filter(Boolean))) as string[]
      await Promise.all(
        unique.map(async (id) => {
          if (!id || userLabelById.value[id]) return
          try {
            const resp = await adminListUsers({ search: id, limit: 1, offset: 0 })
            const user = resp?.data?.users?.[0]
            if (user) {
              userLabelById.value[id] = userDisplay({ username: user.profile?.username, email: user.profile?.email, telegramName: user.profile?.telegramName, id: user.id })
              if (user.profile?.username) userUsernameById.value[id] = user.profile.username
            }
          } catch {}
        }),
      )
    }

    async function ensurePayoutDetails(ids: string[], force = false) {
      const unique = Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))) as string[]
      await Promise.all(
        unique.map(async (id) => {
          if (!force && payoutDetailsByUserId.value[id]) return
          try {
            const resp = await adminAffiliatePayoutDetailsForUser({ userId: id })
            const data = resp?.data
            payoutDetailsByUserId.value[id] = {
              paypalEmail: data?.paypalEmail ?? null,
              totalPaid: Number(data?.totalPaid || 0),
            }
          } catch {
            if (!force && payoutDetailsByUserId.value[id]) return
            payoutDetailsByUserId.value[id] = { paypalEmail: null, totalPaid: 0 }
          }
        }),
      )
    }

    async function fetchAffiliateReceipts() {
      try {
        apLoading.value = true
        const res = await adminAffiliatePayoutReceipts({ limit: 100, offset: 0 })
        apReceipts.value = Array.isArray(res?.data) ? res.data : []
        const ids = apReceipts.value.map((r: any) => r.userId).filter((v: any) => typeof v === "string" && v)
        await ensureUserLabels(ids as string[])
        await ensurePayoutDetails(ids as string[])
      } catch (e) {
        apReceipts.value = []
      } finally {
        apLoading.value = false
      }
    }

    const refetchAffiliateReceipts = () => fetchAffiliateReceipts()

    const dcEditOpen = ref(false)
    const dcEdit = ref({ code: "", discountPct: 0, maximumUses: 1, linkedUserId: "" as string | null | undefined })
    const dcSaving = ref(false)
    const dcUserOptionsCreate = ref<{ label: string; value: string }[]>([])
    const dcUserOptionsEdit = ref<{ label: string; value: string }[]>([])
    async function filterDcUserCreate(val: string, update: (fn: () => void) => void) {
      const q = (val || "").trim()
      if (q.length < 2) {
        update(() => {
          dcUserOptionsCreate.value = []
        })
        return
      }
      try {
        const res = await adminListUsers({ search: q, limit: 10, offset: 0 })
        const users = res?.data?.users || []
        const opts = users.map((u: any) => {
          const label = userDisplay({ username: u.profile?.username, email: u.profile?.email, telegramName: u.profile?.telegramName, id: u.id })
          userLabelById.value[u.id] = label
          if (u.profile?.username) userUsernameById.value[u.id] = u.profile.username
          return { label, value: u.id }
        })
        update(() => {
          dcUserOptionsCreate.value = opts
        })
      } catch {
        update(() => {
          dcUserOptionsCreate.value = []
        })
      }
    }
    async function filterDcUserEdit(val: string, update: (fn: () => void) => void) {
      const q = (val || "").trim()
      if (q.length < 2) {
        update(() => {
          dcUserOptionsEdit.value = []
        })
        return
      }
      try {
        const res = await adminListUsers({ search: q, limit: 10, offset: 0 })
        const users = res?.data?.users || []
        const opts = users.map((u: any) => {
          const label = userDisplay({ username: u.profile?.username, email: u.profile?.email, telegramName: u.profile?.telegramName, id: u.id })
          userLabelById.value[u.id] = label
          if (u.profile?.username) userUsernameById.value[u.id] = u.profile.username
          return { label, value: u.id }
        })
        update(() => {
          dcUserOptionsEdit.value = opts
        })
      } catch {
        update(() => {
          dcUserOptionsEdit.value = []
        })
      }
    }
    function openEditDiscount(row: any) {
      try {
        dcEdit.value.code = row.code
        dcEdit.value.discountPct = Math.round((row.discount || 0) * 100)
        dcEdit.value.maximumUses = row.maximumUses || 1
        dcEdit.value.linkedUserId = row.linkedUserId || ""
        if (row.linkedUserId) {
          // seed option so the select shows a readable label
          const lbl = userLabelById.value[row.linkedUserId] || row.linkedUserId
          userLabelById.value[row.linkedUserId] = lbl
          dcUserOptionsEdit.value = [{ label: lbl, value: row.linkedUserId }]
        }
        dcEditOpen.value = true
      } catch {}
    }
    async function saveEditDiscount() {
      try {
        dcSaving.value = true
        const discount = Math.max(0, Math.min(95, Number(dcEdit.value.discountPct || 0))) / 100
        await adminDiscountCodeUpdate({
          code: (dcEdit.value.code || "").toUpperCase().trim(),
          discount,
          maximumUses: Math.max(1, Number(dcEdit.value.maximumUses || 1)),
          linkedUserId: typeof dcEdit.value.linkedUserId === "string" && dcEdit.value.linkedUserId.trim() ? dcEdit.value.linkedUserId.trim() : null,
        })
        dcEditOpen.value = false
        Notify.create({ type: "positive", message: "Discount code updated" })
        await refetchDiscounts()
      } catch (error) {
        catchErr(error)
      } finally {
        dcSaving.value = false
      }
    }
    function confirmDeleteDiscount(row: any) {
      Dialog.create({
        title: "Delete discount code",
        message: `Are you sure you want to delete code ${row.code}?`,
        cancel: true,
        ok: { label: "Delete", color: "negative" },
      }).onOk(async () => {
        try {
          await adminDiscountCodeDelete({
            code: String(row.code || "")
              .toUpperCase()
              .trim(),
          })
          Notify.create({ type: "positive", message: "Discount code deleted" })
          await refetchDiscounts()
        } catch (error) {
          catchErr(error)
        }
      })
    }

    async function lookupUploader(row: any) {
      try {
        const { data } = await creationsDescribeUploadedImage({ imageId: row.id })
        const userId = data?.userId
        if (!userId) return
        const res = await adminListUsers({ search: userId, limit: 1, offset: 0 })
        const user = res?.data?.users?.[0]
        if (!user) return
        Dialog.create({
          title: "Uploader",
          message: `User: ${userDisplay({ username: user.profile?.username, email: user.profile?.email, telegramName: user.profile?.telegramName, id: user.id })}`,
          cancel: true,
          ok: { label: "Ban", color: "negative" },
          options: {
            type: "checkbox",
            model: [],
            items: [],
          },
        }).onOk(() => confirmBan(user))
      } catch (error) {
        catchErr(error)
      }
    }

    async function banUploader(row: any) {
      try {
        const uid = row?.user?.id
        if (!uid) return
        try {
          const res = await adminListUsers({ search: uid, limit: 1, offset: 0 })
          const user = res?.data?.users?.[0]
          if (user) return confirmBan(user)
        } catch {}
        // fallback minimal row
        const fallbackRow = { id: uid, profile: { username: userDisplay(row.user) }, banned: false }
        confirmBan(fallbackRow as any)
      } catch (error) {
        catchErr(error)
      }
    }

    function confirmDeleteUpload(row: any) {
      Dialog.create({
        title: "Delete uploaded image?",
        message: "This image will be permanently deleted.",
        cancel: true,
        ok: { label: "Delete", color: "negative" },
      }).onOk(async () => {
        try {
          // Prefer orval admin endpoint if available, then admin raw, then user endpoint
          const mod: any = await import("src/lib/orval")
          if (typeof mod.adminDeleteUploadedImage === "function") {
            await mod.adminDeleteUploadedImage({ imageId: row.id })
          } else {
            try {
              await axios.post("/admin/deleteUploadedImage", { imageId: row.id })
            } catch {
              const { creationsDeleteUploadedImage } = await import("src/lib/orval")
              await creationsDeleteUploadedImage({ imageId: row.id })
            }
          }
          Notify.create({ message: "Image deleted", color: "positive", icon: "check" })
          await refetchUploads()
        } catch (error) {
          catchErr(error)
        }
      })
    }

    return {
      userSearch,
      includeBanned,
      usersPagination,
      usersRows,
      usersTotal,
      usersLoading,
      usersFetching,
      userColumns,
      refetchUsers,
      usersExporting,
      exportUsersCsv,
      confirmBan,
      onUsersRequest,
      attribSourceByUserId,
      attribLoading,
      attribSearchHints,
      canOpenAttrib,
      attributionButtonTitle,
      loadAttribForUser,
      collectUserAttribHints,
      mergeAttribHints,

      // payments
      paymentsUserId,
      paymentsMethod,
      paymentsStatus,
      paymentsStart,
      paymentsEnd,
      paymentsPagination,
      paymentsRows,
      paymentsTotal,
      paymentsLoading,
      paymentsFetching,
      paymentsColumns,
      paymentsMethodOptions,
      paymentsStatusOptions,
      refetchPayments,
      onPaymentsRequest,
      paymentsExporting,
      exportPaymentsCsv,
      statusColor,
      labelById,
      userDisplay,
      paymentDiscountInfo,
      formatDiscountPercent,
      formatDiscountAmount,
      profileLinkForUser,
      profileLinkForUsername,
      profileLinkByUserId,

      // uploads
      uploadsAccount,
      uploadsView,
      uploadsViewOptions,
      topPager,
      uploadsStart,
      uploadsEnd,
      uploadsPagination,
      uploadsRows,
      uploadsTotal,
      uploadsLoading,
      uploadsFetching,
      uploadsColumns,
      refetchUploads,
      onUploadsRequest,
      s3Img,
      singleUploaderUser,
      banTopUser,
      lookupUploader,
      banUploader,
      onBottomPageChange,
      confirmDeleteUpload,
      filterUploadsByUser,
      uploadsProfileLink,
      uploadsProfileLabel,

      // training set images
      tsetsAccount,
      tsetsView,
      tsetsTopPager,
      tsetsStart,
      tsetsEnd,
      tsetsPagination,
      tsetsRows,
      tsetsTotal,
      tsetsLoading,
      tsetsFetching,
      tsetsColumns,
      refetchTsets,
      onTsetsRequest,
      filterTsetsByUser,
      onBottomPageChangeTsets,
      tsetsSingleUser,
      tsetsProfileLink,
      tsetsProfileLabel,
      banTopUserTsets,
      lookupUploaderTsets,
      banUploaderTsets,

      // discount codes
      dcRows,
      dcLoading,
      dcFetching,
      dcColumns,
      userLabelById,
      userUsernameById,
      payoutDetailsByUserId,
      dcForm,
      dcCreating,
      createDiscountCode,
      refetchDiscounts,
      openEditDiscount,
      dcEditOpen,
      dcEdit,
      dcSaving,
      saveEditDiscount,
      confirmDeleteDiscount,
      dcUserOptionsCreate,
      dcUserOptionsEdit,
      filterDcUserCreate,
      filterDcUserEdit,
      pendingPayoutRows,
      pendingPayoutColumns,
      confirmAffiliatePayout,

      // affiliate receipts (admin review)
      apReceipts,
      apLoading,
      apColumns,
      refetchAffiliateReceipts,
    }
  },
  data() {
    return {
      promoPoints: 100 as string | number | null,
      claimedPromoCodes: [] as PromoCode[],
      unclaimedPromoCodes: [] as PromoCode[],
      allPromoCodes: [] as PromoCode[],
      promoLoading: false as boolean,
      promoSearch: "" as string,
      promoFilterStatus: "all" as "all" | "unclaimed" | "claimed",
      promoStatusOptions: [
        { label: "All", value: "all", icon: "all_inclusive" },
        { label: "Unclaimed", value: "unclaimed", icon: "check_circle" },
        { label: "Claimed", value: "claimed", icon: "done_all" },
      ] as { label: string; value: "all" | "unclaimed" | "claimed"; icon: string }[],
      promoColumns: [
        { name: "actions", label: "Actions", field: "id", align: "left", sortable: false },
        { name: "code", label: "Code", field: "id", sortable: false },
        { name: "points", label: "Points", field: "points", align: "right", sortable: true },
        { name: "status", label: "Status", field: "claimedAt", sortable: true },
        { name: "claimedBy", label: "Claimed By", field: "claimedByUserId", sortable: false },
        { name: "createdAt", label: "Created", field: "createdAt", sortable: true },
        { name: "claimedAt", label: "Claimed", field: "claimedAt", sortable: true },
      ] as QTableColumn<any>[],
      tab: "promo-codes",
      avatarImg,
      qrDialogOpen: false as boolean,
      qrLink: "" as string,
      qrTitle: "" as string,
      qrDataUrl: "" as string,
      qrLoading: false as boolean,
      imgPreviewOpen: false as boolean,
      imgPreviewSrc: "" as string,
    }
  },
  computed: {
    promoFilteredRows(): any[] {
      try {
        const q = (this.promoSearch || "").trim().toLowerCase()
        const status = this.promoFilterStatus
        const rows = Array.isArray(this.allPromoCodes) ? this.allPromoCodes : []
        return rows.filter((r: any) => {
          if (status === "unclaimed" && r.claimedAt) return false
          if (status === "claimed" && !r.claimedAt) return false
          if (!q) return true
          const sid = this.shortId(String(r.id)).toLowerCase()
          const userLbl = String(this.labelById(r.claimedByUserId) || "").toLowerCase()
          return sid.includes(q) || userLbl.includes(q)
        })
      } catch {
        return []
      }
    },
    promoStats(): { total: number; claimed: number; unclaimed: number; unclaimedPoints: number } {
      const rows = Array.isArray(this.allPromoCodes) ? this.allPromoCodes : []
      let claimed = 0
      let unclaimed = 0
      let unclaimedPoints = 0
      for (const r of rows) {
        if (r.claimedAt) claimed++
        else {
          unclaimed++
          unclaimedPoints += Number(r.points || 0)
        }
      }
      return { total: rows.length, claimed, unclaimed, unclaimedPoints }
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.load()
      },
    },
    tab(val: string) {
      // keep URL in sync with current tab
      const slug = this.slugForTab(val)
      const to: RouteLocationRaw = { name: "admin", params: { adminTab: slug } }
      // avoid navigation if already correct
      if (this.$route.name === "admin" && this.$route.params?.adminTab === slug) {
        // already in sync
      } else {
        void this.$router.replace(to)
      }
      void this.load()
    },
    "$route.params.adminTab": {
      immediate: true,
      handler(val: any) {
        const desired = this.normalizeAdminTab(typeof val === "string" ? val : undefined)
        if (this.tab !== desired) this.tab = desired
      },
    },
  },
  mounted() {},

  methods: {
    // --- Promo Codes helpers ---
    shortId(id: string) {
      try {
        return longIdToShort(id)
      } catch {
        return id
      }
    },
    claimLink(id: string) {
      try {
        return `${window.location.origin}/claim/${this.shortId(id)}`
      } catch {
        return ""
      }
    },
    async loadPromoCodes() {
      try {
        this.promoLoading = true
        const response = await promoGetPromoCodes()
        const allPromoCodes = response?.data || []
        this.allPromoCodes = allPromoCodes
        // Keep legacy arrays for any external usage
        this.claimedPromoCodes = allPromoCodes
          .filter((code: any) => code.claimedAt)
          .sort((a: any, b: any) => new Date(a.claimedAt as string).getTime() - new Date(b.claimedAt as string).getTime())
          .reverse()
        this.unclaimedPromoCodes = allPromoCodes
          .filter((code: any) => !code.claimedAt)
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .reverse()
        // Ensure user labels for claimed codes
        const ids = Array.from(new Set(allPromoCodes.map((c: any) => c.claimedByUserId).filter((v: any) => typeof v === "string" && v))) as string[]
        await Promise.all(
          ids.map(async (id) => {
            try {
              if (this.userLabelById[id]) return
              const resp = await adminListUsers({ search: id, limit: 1, offset: 0 })
              const user = resp?.data?.users?.[0]
              if (user) {
                this.userLabelById[id] = this.userDisplay({ username: user.profile?.username, email: user.profile?.email, telegramName: user.profile?.telegramName, id: user.id })
                if (user.profile?.username) this.userUsernameById[id] = user.profile.username
              }
            } catch {}
          }),
        )
      } catch (error) {
        catchErr(error)
      } finally {
        this.promoLoading = false
      }
    },
    confirmDeletePromo(row: any) {
      if (!row || !row.id) return
      Dialog.create({
        title: "Delete promo code",
        message: `Delete promo code ${this.shortId(row.id)}?`,
        cancel: true,
        ok: { label: "Delete", color: "negative" },
      }).onOk(async () => {
        try {
          await promoDeletePromoCode({ id: String(row.id) })
          Notify.create({ type: "positive", message: "Promo code deleted" })
          await this.loadPromoCodes()
        } catch (error) {
          catchErr(error)
        }
      })
    },
    normalizeAdminTab(slug?: string): string {
      const allowed = new Set(["promo-codes", "motd", "email-funnels", "users", "user-attributions", "payments", "uploaded-images", "training-images", "discount-codes", "affiliate-payouts", "stats"]) as Set<string>
      if (!slug) return "promo-codes"
      return allowed.has(slug) ? slug : "promo-codes"
    },
    slugForTab(tab: string): string {
      return this.normalizeAdminTab(tab)
    },
    async loginAsUser(userId: string) {
      await this.$userAuth.adminLoginAsUser(userId)
      await this.$router.push({ name: "settings" })
    },
    openImagePreview(imageId: string) {
      try {
        this.imgPreviewSrc = s3Img("uploads/" + imageId)
        this.imgPreviewOpen = true
      } catch {
        this.imgPreviewSrc = ""
        this.imgPreviewOpen = false
      }
    },
    openThumbPreview(url: string) {
      try {
        this.imgPreviewSrc = url
        this.imgPreviewOpen = true
      } catch {
        this.imgPreviewSrc = ""
        this.imgPreviewOpen = false
      }
    },
    copyCode(codeId: string) {
      const claimUrl = `${window.location.origin}/claim/${longIdToShort(codeId)}`
      void copyToClipboard(claimUrl)
    },
    copyMagicMirror(codeId: string) {
      const mmUrl = `${window.location.origin}/magicMirror?claimCode=${longIdToShort(codeId)}`
      void copyToClipboard(mmUrl)
      Notify.create({ message: "Magic Mirror promo link copied to clipboard", color: "positive", icon: "check" })
    },
    copyMagicMirrorFast(codeId: string) {
      const fastUrl = `${window.location.origin}/magicMirrorBanana?claimCode=${longIdToShort(codeId)}`
      void copyToClipboard(fastUrl)
      Notify.create({ message: "Magic Mirror Fast promo link copied to clipboard", color: "positive", icon: "check" })
    },
    showClaimQr(codeId: string) {
      const claimUrl = `${window.location.origin}/claim/${longIdToShort(codeId)}`
      void this.openQr(claimUrl, "Claim Promo")
    },
    showMmQr(codeId: string) {
      const mmUrl = `${window.location.origin}/magicMirror?claimCode=${longIdToShort(codeId)}`
      void this.openQr(mmUrl, "Magic Mirror")
    },
    showMmFastQr(codeId: string) {
      const fastUrl = `${window.location.origin}/magicMirrorBanana?claimCode=${longIdToShort(codeId)}`
      void this.openQr(fastUrl, "Magic Mirror Fast")
    },
    async openQr(link: string, title = "Scan QR") {
      try {
        this.qrDialogOpen = true
        this.qrLink = link
        this.qrTitle = title
        this.qrLoading = true
        this.qrDataUrl = await QRCode.toDataURL(link, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 1024,
          color: { dark: "#000000", light: "#ffffff" },
        })
      } catch (error) {
        catchErr(error)
      } finally {
        this.qrLoading = false
      }
    },
    copyQrLink() {
      if (!this.qrLink) return
      void copyToClipboard(this.qrLink)
      Notify.create({ message: "Link copied", color: "positive", icon: "check" })
    },

    async createPromoCode(kind: "claim" | "mm" = "claim") {
      try {
        const response = await promoCreatePromoCode({ points: this.promoPoints ? Number(this.promoPoints) : 0 })
        const code = response?.data
        if (!code) return

        const shortId = longIdToShort(code.id)
        const claimUrl = `${window.location.origin}/claim/${shortId}`
        const mmUrl = `${window.location.origin}/magicMirror?claimCode=${shortId}`
        const urlToCopy = kind === "mm" ? mmUrl : claimUrl
        void copyToClipboard(urlToCopy)
        void this.openQr(urlToCopy, kind === "mm" ? "Magic Mirror" : "Claim Promo")
        await this.loadPromoCodes()
        Notify.create({
          message: kind === "mm" ? `Promo created (${this.promoPoints} points). Magic Mirror link copied` : `Promo created (${this.promoPoints} points). Claim link copied`,
          type: "success",
          color: "positive",
          icon: "check",
        })
      } catch (error) {
        catchErr(error)
      }
    },
    async load() {
      try {
        if (this.tab == "promo-codes") {
          await this.loadPromoCodes()
        } else if (this.tab == "users") {
          // Users list handled by vue-query in setup()
        } else if (this.tab == "uploaded-images") {
          // Trigger initial fetch for uploads
          void this.refetchUploads()
        } else if (this.tab == "training-images") {
          // Trigger initial fetch for training set images
          void this.refetchTsets()
        } else if (this.tab == "discount-codes") {
          void this.refetchDiscounts()
        } else if (this.tab == "affiliate-payouts") {
          void this.refetchDiscounts()
          void this.refetchAffiliateReceipts()
        }
      } catch (error) {
        catchErr(error)
      }
    },
    openAttributionDialog(row: any) {
      try {
        const user = typeof row?.id === "string" ? row : row?.user && typeof row.user.id === "string" ? row.user : null
        const userId = user?.id || row?.id || row?.userId || row?.user?.id
        if (!userId) return
        const username = user?.profile?.username ?? user?.username ?? row?.profile?.username ?? row?.username ?? row?.user?.profile?.username ?? null
        const hintSet = new Set<string>()
        const collect = this.collectUserAttribHints
        if (typeof collect === "function") {
          const baseHints = collect(user || {})
          baseHints.forEach((hint: string) => hintSet.add(hint))
          if (row && row !== user) {
            collect(row).forEach((hint: string) => hintSet.add(hint))
          }
        }
        const hintArray = Array.from(hintSet)
        const merged = typeof this.mergeAttribHints === "function" ? this.mergeAttribHints(userId, hintArray) : { hints: hintArray }
        if (typeof this.loadAttribForUser === "function") {
          void this.loadAttribForUser(userId, hintArray)
        }
        Dialog.create({
          component: UserAttributionDetails,
          componentProps: {
            userId,
            username,
            searchHints: Array.isArray(merged?.hints) ? merged.hints : hintArray,
          },
        })
      } catch (e) {}
    },
  },
})
</script>

<style lang="scss">
.admin-page {
  .q-table .q-td.no-wrap,
  .q-table .q-th.no-wrap {
    white-space: nowrap;
  }
  // prevent badge/button wrapping within small cells
  .q-table .no-wrap .row.no-wrap {
    flex-wrap: nowrap;
  }
}
</style>

<style lang="sass" scoped>
.admin-page
  overflow-x: hidden

.admin-link
  color: #1976d2
  cursor: pointer
  text-decoration: underline

.admin-link:hover
  color: #0d47a1

.qr-dialog-card
  width: 100%
  max-width: 100%
  background-color: #000
</style>
