<template lang="pug">
q-page.full-height.full-width.admin-page
  .centered.q-mt-md
    h4 Admin
  div(v-if="$userAuth.loggedIn && $userAuth.userData?.admin").q-pt-md
    q-tabs(v-model="tab" ).q-mb-md
      q-tab( name="promo-codes" label="Promo Codes")
      q-tab(name="users" label="Users")
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
import { avatarImg } from "lib/netlifyImg"
import { longIdToShort, catchErr } from "lib/util"
import { copyToClipboard, Dialog, Notify } from "quasar"
import type { QTableColumn } from "quasar"
import { defineComponent, ref, computed, watch } from "vue"
import { promoCreatePromoCode, promoGetPromoCodes, useAdminListUsers, useAdminBanUser } from "src/lib/orval"
import QRCode from "qrcode"

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
