<template lang="pug">
q-page.full-height.full-width.admin-page
  .centered.q-mt-md
    h4 Admin
  div(v-if="$userAuth.loggedIn && $userAuth.userData?.admin").q-pt-md
    q-tabs(v-model="tab" ).q-mb-md
      q-tab( name="promo-codes" label="Promo Codes")
      q-tab(name="users" label="Users")
      q-tab(name="payments" label="Payments")
      q-tab(name="uploaded-images" label="Uploaded Images")
    div(v-if="tab == 'promo-codes'")
      .centered.q-mb-md
        q-card.q-pa-md
          .centered
            h4 Create Promo Code
          .q-ma-md
            q-input(v-model.number="promoPoints" type="number" label="Points" input-style="font-size:16px;" inputmode="numeric")
          .centered
            q-btn(label="Create + Copy Claim Link" @click="createPromoCode('claim')" icon="add")
            q-btn(label="Create + Copy MagicMirror Link" class="q-ml-sm" @click="createPromoCode('mm')" icon="add")
      .centered.q-gutter-md
        q-card.q-pa-md(style="max-width:400px; overflow: auto;")
          .centered
            h4 Unclaimed Promo Codes
          q-list
            q-item(v-for="code in unclaimedPromoCodes" :key="code.id")
              pre(style="font-size:10px; white-space:pre-wrap; max-width:90vw; overflow:auto; overflow-wrap:anywhere; word-break:break-word;") {{ code }}
              .row.q-gutter-xs.q-mt-xs
                q-btn(size="sm" label="copy claim" @click="copyCode(code.id)" icon="content_copy" flat)
                q-btn(size="sm" label="copy MM Pro" @click="copyMagicMirror(code.id)" icon="content_copy" flat)
                q-btn(size="sm" label="copy MM Fast" @click="copyMagicMirrorFast(code.id)" icon="content_copy" flat)
                q-btn(size="sm" label="claim QR" @click="showClaimQr(code.id)" icon="qr_code" color="primary" flat)
                q-btn(size="sm" label="MM Pro QR" @click="showMmQr(code.id)" icon="qr_code" color="accent" flat)
                q-btn(size="sm" label="MM Fast QR" @click="showMmFastQr(code.id)" icon="qr_code" color="accent" flat)
        q-card.q-pa-md
          .centered
            h4 Claimed Promo Codes
          q-list
            q-item(v-for="code in claimedPromoCodes" :key="code.id")
                          pre(style="font-size:10px; white-space:pre-wrap; max-width:90vw; overflow:auto; overflow-wrap:anywhere; word-break:break-word;") {{ code }}
    div(v-if="tab == 'users'").q-pa-sm
      .row.items-center.q-gutter-sm.q-mb-sm
        q-input(v-model="userSearch" debounce="400" placeholder="Search users..." dense outlined clearable style="min-width:240px")
        q-toggle(v-model="includeBanned" label="Include banned" dense)
        q-space
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
              span {{ userDisplay(props.row.user) }}
              q-btn(size="sm" icon="login" flat @click="loginAsUser(props.row.user.id)" class="q-ml-xs")
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
      q-input(v-model="uploadsAccount" debounce="400" placeholder="Filter by account (username/email/id)" dense outlined clearable style="min-width:260px")
      q-space
      q-btn(v-if="uploadsAccount" icon="block" color="negative" flat :label="singleUploaderUser ? `Ban ${userDisplay(singleUploaderUser)}` : 'Ban account'" @click="banTopUser")
      q-btn(icon="refresh" flat @click="refetchUploads" :loading="uploadsFetching")
    q-table(
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
      :rows-per-page-options="[10,25,50,100,0]"
      :no-data-label="'No uploaded images found'"
    )
      template(#body-cell-preview="props")
        q-td(:props="props")
          q-img(:src="s3Img('uploads/' + props.row.id)" style="width:60px; height:60px; object-fit:cover; border-radius:4px;")
      template(#body-cell-user="props")
        q-td(:props="props") {{ userDisplay(props.row.user) }}
      template(#body-cell-createdAt="props")
        q-td(:props="props") {{ props.row.createdAt ? new Date(props.row.createdAt).toLocaleString() : '' }}
      template(#body-cell-actions="props")
        q-td(:props="props")
          .row.items-center.q-gutter-xs
            q-btn(size="sm" icon="delete" color="negative" flat @click="confirmDeleteUpload(props.row)")
            q-btn(size="sm" icon="person_search" flat v-if="!uploadsAccount" @click="lookupUploader(props.row)")
  .centered.q-gutter-lg.q-ma-md(v-else)
    h2 You need to be logged in as an admin to view this page





// Fullscreen QR dialog
q-dialog(v-model="qrDialogOpen" maximized)
  q-card.q-dialog-plugin.qr-dialog-card
    .centered.full-width.q-pa-lg(style="min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;")
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
</template>

<script lang="ts">
import { PromoCode } from "lib/api"
import { jwt } from "lib/jwt"
import { avatarImg, s3Img } from "lib/netlifyImg"
import { longIdToShort, catchErr } from "lib/util"
import { copyToClipboard, Dialog, Notify } from "quasar"
import type { QTableColumn } from "quasar"
import { defineComponent, ref, computed, watch } from "vue"
import { promoCreatePromoCode, promoGetPromoCodes, useAdminListUsers, useAdminBanUser, useAdminListPayments, creationsDescribeUploadedImage, adminListUsers } from "src/lib/orval"
import QRCode from "qrcode"
import axios from "axios"

type TablePagination = { sortBy: string; descending: boolean; page: number; rowsPerPage: number }
type OnRequestProps = { pagination: TablePagination }

export default defineComponent({
  components: {},

  setup() {
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
      return rpp === 0 ? 1000 : rpp
    })
    const offset = computed(() => {
      const rpp = usersPagination.value.rowsPerPage
      const page = usersPagination.value.page
      if (rpp === 0) return 0
      return (page - 1) * rpp
    })

    const params = computed(() => ({
      limit: limit.value,
      offset: offset.value,
      search: userSearch.value?.trim() ? userSearch.value.trim() : undefined,
      includeBanned: includeBanned.value ? true : undefined,
    }))

    const usersQuery = useAdminListUsers(params)
    const usersRows = computed(() => {
      const rows = usersQuery.data?.value?.data?.users || []
      const sortBy = usersPagination.value.sortBy || "spentPoints"
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
      return rpp === 0 ? 1000 : rpp
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

    const statusColor = (status: string) => {
      if (!status) return "grey-6"
      const s = status.toLowerCase()
      if (s.includes("fail") || s.includes("declin") || s.includes("error")) return "negative"
      if (s.includes("pend") || s.includes("incom")) return "warning"
      if (s.includes("succe") || s.includes("complet") || s.includes("paid")) return "positive"
      return "grey-6"
    }

    const userDisplay = (user: any) => user?.username || user?.email || user?.telegramName || user?.telegramId || user?.id || "-"

    const paymentsColumns: QTableColumn<any>[] = [
      { name: "createdAt", label: "Date", field: "createdAt", sortable: true, format: (val: string) => (val ? new Date(val).toLocaleString() : "") },
      { name: "user", label: "User", field: (row: any) => row.user?.username || row.user?.email || row.user?.telegramName || row.user?.telegramId || row.user?.id || "-", sortable: true },
      { name: "method", label: "Method", field: "method", sortable: true },
      { name: "status", label: "Status", field: "status", sortable: true },
      { name: "points", label: "Points", field: "points", align: "right", sortable: true, format: (val: number) => (val ?? 0).toLocaleString() },
      { name: "amountUsd", label: "USD", field: "amountUsd", align: "right", sortable: true, format: (val: number) => (val != null ? `$${val.toFixed(2)}` : "") },
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
      { name: "email", label: "Email", field: (row: any) => row.profile?.email || "", sortable: true },
      { name: "telegram", label: "Telegram", field: (row: any) => row.profile?.telegramName || row.profile?.telegramId || "", sortable: true },
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
      return rpp === 0 ? 1000 : rpp
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
        const params: any = {
          limit: limit3.value,
          offset: offset3.value,
          order: uploadsPagination.value.descending ? "desc" : "asc",
        }
        if (uploadsAccount.value?.trim()) params.account = uploadsAccount.value.trim()
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
        } catch (err) {
          // last resort
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
      } finally {
        uploadsLoading.value = false
        uploadsFetching.value = false
      }
    }

    const refetchUploads = () => fetchUploads(false)
    const onUploadsRequest = (props: OnRequestProps) => {
      uploadsPagination.value = props.pagination
      void refetchUploads()
    }
    watch(uploadsAccount, () => {
      uploadsPagination.value.page = 1
      void refetchUploads()
    })

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
      confirmBan,
      onUsersRequest,

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
      statusColor,
      userDisplay,

      // uploads
      uploadsAccount,
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
      confirmDeleteUpload,
    }
  },
  data() {
    return {
      promoPoints: 100 as string | number | null,
      claimedPromoCodes: [] as PromoCode[],
      unclaimedPromoCodes: [] as PromoCode[],
      tab: "promo-codes",
      avatarImg,
      qrDialogOpen: false as boolean,
      qrLink: "" as string,
      qrTitle: "" as string,
      qrDataUrl: "" as string,
      qrLoading: false as boolean,
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.load()
      },
    },
    tab() {
      void this.load()
    },
  },
  mounted() {},

  methods: {
    async loginAsUser(userId: string) {
      await this.$userAuth.adminLoginAsUser(userId)
      await this.$router.push({ name: "settings" })
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
        void this.load()
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
          const response = await promoGetPromoCodes()
          const allPromoCodes = response?.data || []

          this.claimedPromoCodes = allPromoCodes
            .filter((code) => code.claimedAt)
            .sort((a, b) => new Date(a.claimedAt as string).getTime() - new Date(b.claimedAt as string).getTime())
            .reverse()
          this.unclaimedPromoCodes = allPromoCodes
            .filter((code) => !code.claimedAt)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .reverse()
        } else if (this.tab == "users") {
          // Users list handled by vue-query in setup()
        } else if (this.tab == "uploaded-images") {
          // Trigger initial fetch for uploads
          void this.refetchUploads()
        }
      } catch (error) {
        catchErr(error)
      }
    },
  },
})
</script>

<style lang="sass" scoped>
.admin-page
  overflow-x: hidden

.qr-dialog-card
  width: 100%
  max-width: 100%
  background-color: #000
</style>
