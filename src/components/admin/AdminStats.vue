<template lang="pug">
.q-pa-sm
  // Live stats header
  .row.items-center.q-gutter-sm.q-mb-sm
    h5.q-my-none Live Stats
    q-space
    q-btn(icon="refresh" flat @click="refreshLive" :loading="loadingLive")

  .row.q-col-gutter-sm.q-mb-lg
    q-card.col-12.col-sm-6.col-md-3(v-for="card in liveCards" :key="card.key" flat bordered)
      .q-pa-md
        .row.items-center
          .col
            div.text-caption.text-grey-7 {{ card.label }}
            div.text-h5 {{ formatNumber(card.value) }}

  // Historical trends
  .row.items-center.q-gutter-sm.q-mb-sm
    h5.q-my-none Historical Trends
    q-space
    q-btn-toggle(v-model="groupBy" :options="groupOptions" spread rounded toggle-color="primary" color="grey-5" dense)
    q-input(v-model="fromStr" type="datetime-local" label="From" dense outlined clearable style="min-width:220px")
    q-input(v-model="toStr" type="datetime-local" label="To" dense outlined clearable style="min-width:220px")
    q-input(v-model.number="limit" type="number" label="Limit" dense outlined clearable style="width:120px")
    q-btn(icon="download" label="Export CSV" color="primary" outline @click="exportHistoryCsv" :loading="exportingHistory")
    q-btn(icon="refresh" label="Load" color="primary" unelevated @click="refreshAll" :loading="loadingHistory || loadingWeekly")

  .row.q-col-gutter-sm
    q-card.col-12.col-md-6.col-lg-4(v-for="m in metricsToShow" :key="m.key" flat bordered)
      .q-pa-md
        .row.items-center.q-mb-sm
          .col
            div.text-caption.text-grey-7 {{ m.label }}
            div.text-h6 {{ formatNumber(latestValue(historySeries[m.key])) }}
          q-badge(v-if="historySeries[m.key]?.length" color="grey-5" text-color="black" :label="`${historySeries[m.key]?.length || 0} pts`")
        SimpleLineChart(:values="historySeries[m.key] || []" :height="120" :stroke-color="m.color" :show-area="true" :show-axis-labels="false")

  // Empty state
  .q-mt-md.text-center.text-grey-7(v-if="!loadingHistory && totalHistoryPoints === 0")
    span No history data for selected range

  // Payments by method (weekly)
  .row.items-center.q-gutter-sm.q-mt-lg
    h6.q-my-none Payments by Method (Weekly)
    q-space
    q-input(v-model.number="weeklyWeeks" type="number" label="Weeks" dense outlined clearable style="width:120px")
    q-input(v-model="weeklyEndStr" type="datetime-local" label="End At" dense outlined clearable style="min-width:220px")
    q-btn(icon="refresh" flat @click="refreshWeekly" :loading="loadingWeekly")

  .row.q-col-gutter-sm
    q-card.col-12.col-md-6.col-lg-4(flat bordered)
      .q-pa-md
        .row.items-center.q-mb-sm
          .col
            div.text-caption.text-grey-7 Weekly Active Users
            div.text-h6 {{ formatNumber(latestValue(weeklyActiveUsersSeries)) }}
          q-badge(v-if="weeklyActiveUsersSeries?.length" color="grey-5" text-color="black" :label="`${weeklyActiveUsersSeries?.length || 0} wks`")
        SimpleLineChart(:values="weeklyActiveUsersSeries" :height="120" stroke-color="#1976d2" :show-area="true" :show-axis-labels="false")

  .row.q-col-gutter-sm
    q-card.col-12.col-md-6.col-lg-4(v-for="pm in paymentMethodSeries" :key="pm.key" flat bordered)
      .q-pa-md
        .row.items-center.q-mb-sm
          .col
            div.text-caption.text-grey-7 {{ pm.label }}
            div.text-h6 {{ formatNumber(latestValue(pm.values)) }}
          q-badge(v-if="pm.values?.length" color="grey-5" text-color="black" :label="`${pm.values?.length || 0} wks`")
        SimpleLineChart(:values="pm.values" :height="120" :stroke-color="pm.color" :show-area="true" :show-axis-labels="false")
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Notify } from 'quasar'
import SimpleLineChart from './SimpleLineChart.vue'
import { statsUsers, statsImages, statsCollections, statsPayments, statsHistory, statsWeekly, type StatsUsers200, type StatsImages200, type StatsCollections200, type StatsPayments200, type StatsHistory200SnapshotsItem } from 'src/lib/orval'

// Live stats state
const loadingLive = ref(false)
const live = ref<{ users: StatsUsers200; images: StatsImages200; collections: StatsCollections200; payments: StatsPayments200 }>({
  users: { spentPoints: 0, spentOver100Points: 0, spentOver1000Points: 0, spentOver10000Points: 0, spentOver20000Points: 0, purchasedImage: 0, createdImage: 0, emailVerified: 0, phoneVerified: 0, instagramVerified: 0, twitterVerified: 0, setUsername: 0 },
  images: { totalCreated: 0, totalUpscaled: 0, totalImageCreateRequests: 0, averageImageQuantityPerCreateRequest: { _avg: { quantity: null } }, purchasedImages: 0, totalPurchases: 0, privateImages: 0, imagesInAtLeastOneCollection: 0, imageCreationFailed: 0 },
  collections: { collectionsCreated: 0, emptyCollections: 0 },
  payments: { incompletePayPayPalOrders: 0, completePayPayPalOrders: 0, paypalOrdersTotalPaid: { _sum: { amount: null } } },
})

const formatNumber = (n?: number | null) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (Math.abs(v) >= 1000) return v.toLocaleString()
  return String(v)
}

async function refreshLive() {
  try {
    loadingLive.value = true
    const [u, i, c, p] = await Promise.all([statsUsers(), statsImages(), statsCollections(), statsPayments()])
    live.value.users = u?.data || live.value.users
    live.value.images = i?.data || live.value.images
    live.value.collections = c?.data || live.value.collections
    live.value.payments = p?.data || live.value.payments
  } catch (e) {
    // ignore for now
  } finally {
    loadingLive.value = false
  }
}

const liveCards = computed(() => [
  { key: 'users_spent', label: 'Users Spent > 0', value: live.value.users.spentPoints as number },
  { key: 'images_created', label: 'Images Created', value: live.value.images.totalCreated as number },
  { key: 'collections', label: 'Collections Created', value: live.value.collections.collectionsCreated as number },
  { key: 'payments_paid', label: 'Total Paid (USD)', value: Number(live.value.payments?.paypalOrdersTotalPaid?._sum?.amount || 0) as number },
])

// History state
const loadingHistory = ref(false)
const fromStr = ref<string | null>(defaultFrom())
const toStr = ref<string | null>(null)
const limit = ref<number | null>(90)
const history = ref<{ snapshots: any[] }>({ snapshots: [] })
const groupBy = ref<'daily' | 'weekly'>('weekly')
const groupOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
]

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  const s = d.toISOString()
  return s.slice(0, 16) // yyyy-MM-ddTHH:mm
}

async function refreshHistory() {
  try {
    loadingHistory.value = true
    const params: any = {}
    if (fromStr.value) params.from = new Date(fromStr.value).toISOString()
    if (toStr.value) params.to = new Date(toStr.value).toISOString()
    if (limit.value != null && Number(limit.value) > 0) params.limit = Number(limit.value)
    const res = await statsHistory(params)
    history.value = res?.data || { snapshots: [] }
  } catch (e) {
    history.value = { snapshots: [] }
  } finally {
    loadingHistory.value = false
  }
}

// Weekly metrics (WAU and payments by method)
const loadingWeekly = ref(false)
const weeklyWeeks = ref<number>(12)
const weeklyEndStr = ref<string | null>(null)
const weekly = ref<{ buckets: any[] }>({ buckets: [] })

function weekStartKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay() || 7 // Sunday = 7
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1)) // back to Monday
  const yyyy = x.getUTCFullYear()
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(x.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function buildWeekKeys(fromISO?: string | null, toISO?: string | null): string[] {
  const start = fromISO ? new Date(fromISO) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const end = toISO ? new Date(toISO) : new Date()
  const keys: string[] = []
  // align to Monday of start week
  let cur = new Date(start)
  cur = new Date(weekStartKey(cur) + 'T00:00:00.000Z')
  while (cur <= end) {
    keys.push(weekStartKey(cur))
    cur.setUTCDate(cur.getUTCDate() + 7)
  }
  return keys
}

// no-op left from older aggregation logic; kept helpers above for history grouping

async function refreshWeekly() {
  try {
    loadingWeekly.value = true
    const params: any = {}
    if (weeklyWeeks.value && Number(weeklyWeeks.value) > 0) params.weeks = Number(weeklyWeeks.value)
    if (weeklyEndStr.value) params.endAt = new Date(weeklyEndStr.value).toISOString()
    const res = await statsWeekly(params)
    weekly.value = res?.data || { buckets: [] }
  } catch (e) {
    weekly.value = { buckets: [] }
  } finally {
    loadingWeekly.value = false
  }
}

async function refreshAll() {
  await refreshHistory()
  await refreshWeekly()
}

const metricsToShow = [
  { key: 'usersSpentPointsGt0', label: 'Users Spent > 0', color: '#1976d2' },
  { key: 'usersPurchasedImage', label: 'Users Purchased Image', color: '#26A69A' },
  { key: 'usersCreatedImage', label: 'Users Created Image', color: '#9C27B0' },
  { key: 'imagesTotalCreated', label: 'Images Created', color: '#42A5F5' },
  { key: 'imagesPurchased', label: 'Images Purchased', color: '#FF7043' },
  { key: 'imageRequestsTotal', label: 'Image Requests', color: '#66BB6A' },
  { key: 'collectionsCreated', label: 'Collections Created', color: '#AB47BC' },
  { key: 'paymentsTotalPaid', label: 'Paid (USD)', color: '#EF5350' },
]

function groupHistoryDaily(snaps: any[], key: string): number[] {
  return snaps.map((s: any) => Number(s?.[key] ?? 0))
}

function groupHistoryWeekly(snaps: any[], key: string): number[] {
  if (!snaps.length) return []
  // Build week keys across displayed range (from/to)
  const fromISO = fromStr.value ? new Date(fromStr.value).toISOString() : undefined
  const toISO = toStr.value ? new Date(toStr.value).toISOString() : undefined
  const weeks = buildWeekKeys(fromISO, toISO)
  const buckets: Record<string, number> = {}
  for (const s of snaps) {
    const d = new Date(s?.bucketStart || s?.date || s?.time || 0)
    const wk = weekStartKey(d)
    const v = Number(s?.[key] ?? 0)
    buckets[wk] = (buckets[wk] || 0) + (Number.isFinite(v) ? v : 0)
  }
  return weeks.map(wk => Number(buckets[wk] || 0))
}

const historySeries = computed<Record<string, number[]>>(() => {
  const map: Record<string, number[]> = {}
  const snaps = Array.isArray(history.value?.snapshots) ? history.value.snapshots : []
  for (const m of metricsToShow) {
    map[m.key] = groupBy.value === 'weekly' ? groupHistoryWeekly(snaps, m.key) : groupHistoryDaily(snaps, m.key)
  }
  return map
})

const totalHistoryPoints = computed(() => Object.values(historySeries.value)[0]?.length || 0)
const latestValue = (arr?: number[]) => (arr && arr.length ? arr[arr.length - 1] : 0)

onMounted(async () => {
  await refreshLive()
  await refreshAll()
})

watch([fromStr, toStr, groupBy], async () => {
  await refreshAll()
})

const paymentMethodColors: Record<string, string> = {
  payPal: '#2962FF',
  crypto: '#00BFA5',
  stars: '#FF6D00',
}

const weeklyActiveUsersSeries = computed<number[]>(() => {
  const buckets = Array.isArray(weekly.value?.buckets) ? weekly.value.buckets : []
  return buckets.map((b: any) => Number(b?.activeUsers ?? 0))
})

const paymentMethodSeries = computed(() => {
  const buckets = Array.isArray(weekly.value?.buckets) ? weekly.value.buckets : []
  const methods = ['payPal', 'crypto', 'stars']
  return methods.map(m => {
    const values = buckets.map((b: any) => Number(b?.payments?.byMethod?.[m] ?? 0))
    return { key: m, label: `${m} (USD)`, values, color: paymentMethodColors[m] || '#1976d2' }
  })
})

// CSV export for history (respects filters and grouping)
const exportingHistory = ref(false)

// Keys to export from snapshots (keep order stable)
type Snap = StatsHistory200SnapshotsItem
type NumericKey = Exclude<keyof Snap, 'bucketStart' | 'imageRequestsAvgQuantity'>
const NUMERIC_KEYS: readonly NumericKey[] = [
  'usersSpentPointsGt0',
  'usersSpentOver100',
  'usersSpentOver1000',
  'usersSpentOver10000',
  'usersSpentOver20000',
  'usersPurchasedImage',
  'usersCreatedImage',
  'usersEmailVerified',
  'usersPhoneVerified',
  'usersInstagramVerified',
  'usersTwitterVerified',
  'usersSetUsername',
  'imagesTotalCreated',
  'imagesTotalUpscaled',
  'imageRequestsTotal',
  // imageRequestsAvgQuantity handled separately (avg across week)
  'imagesPurchased',
  'purchasesTotal',
  'imagesPrivate',
  'imagesInAtLeastOneCollection',
  'imagesCreationFailed',
  'collectionsCreated',
  'collectionsWithImages',
  'paymentsIncompletePayPalOrders',
  'paymentsCompletePayPalOrders',
  'paymentsTotalPaid',
] as const

function escapeCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  const needsQuotes = /[",\n]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

async function exportHistoryCsv() {
  if (exportingHistory.value) return
  exportingHistory.value = true
  try {
    const params: { from?: string; to?: string; limit?: number } = {}
    if (fromStr.value) params.from = new Date(fromStr.value).toISOString()
    if (toStr.value) params.to = new Date(toStr.value).toISOString()
    if (limit.value != null && Number(limit.value) > 0) params.limit = Number(limit.value)
    const res = await statsHistory(params)
    const snapsRaw: Snap[] = Array.isArray(res?.data?.snapshots) ? (res!.data!.snapshots as Snap[]) : []

    // Build rows depending on grouping
    type Row = { bucketStart: string } & { [K in NumericKey]: number } & { imageRequestsAvgQuantity?: number }
    let rows: Row[] = []

    if (groupBy.value === 'daily') {
      rows = snapsRaw.map((s) => {
        const r: Row = {
          bucketStart: s.bucketStart,
          // initialize numeric keys to 0 then assign
          usersSpentPointsGt0: 0,
          usersSpentOver100: 0,
          usersSpentOver1000: 0,
          usersSpentOver10000: 0,
          usersSpentOver20000: 0,
          usersPurchasedImage: 0,
          usersCreatedImage: 0,
          usersEmailVerified: 0,
          usersPhoneVerified: 0,
          usersInstagramVerified: 0,
          usersTwitterVerified: 0,
          usersSetUsername: 0,
          imagesTotalCreated: 0,
          imagesTotalUpscaled: 0,
          imageRequestsTotal: 0,
          imagesPurchased: 0,
          purchasesTotal: 0,
          imagesPrivate: 0,
          imagesInAtLeastOneCollection: 0,
          imagesCreationFailed: 0,
          collectionsCreated: 0,
          collectionsWithImages: 0,
          paymentsIncompletePayPalOrders: 0,
          paymentsCompletePayPalOrders: 0,
          paymentsTotalPaid: 0,
        }
        for (const k of NUMERIC_KEYS) r[k] = Number((s as Snap)[k] ?? 0)
        if (typeof s.imageRequestsAvgQuantity === 'number' && Number.isFinite(s.imageRequestsAvgQuantity)) {
          r.imageRequestsAvgQuantity = s.imageRequestsAvgQuantity
        }
        return r
      })
    } else {
      // weekly grouping: sum numeric keys per week, and average the daily averages across the week
      const fromISO = fromStr.value ? new Date(fromStr.value).toISOString() : undefined
      const toISO = toStr.value ? new Date(toStr.value).toISOString() : undefined
      const weeks = buildWeekKeys(fromISO, toISO)
      const agg: Record<string, Row & { _avgSum: number; _avgCount: number }> = {}

      for (const s of snapsRaw) {
        const wk = weekStartKey(new Date(s.bucketStart))
        if (!agg[wk]) {
          agg[wk] = {
            bucketStart: wk,
            usersSpentPointsGt0: 0,
            usersSpentOver100: 0,
            usersSpentOver1000: 0,
            usersSpentOver10000: 0,
            usersSpentOver20000: 0,
            usersPurchasedImage: 0,
            usersCreatedImage: 0,
            usersEmailVerified: 0,
            usersPhoneVerified: 0,
            usersInstagramVerified: 0,
            usersTwitterVerified: 0,
            usersSetUsername: 0,
            imagesTotalCreated: 0,
            imagesTotalUpscaled: 0,
            imageRequestsTotal: 0,
            imagesPurchased: 0,
            purchasesTotal: 0,
            imagesPrivate: 0,
            imagesInAtLeastOneCollection: 0,
            imagesCreationFailed: 0,
            collectionsCreated: 0,
            collectionsWithImages: 0,
            paymentsIncompletePayPalOrders: 0,
            paymentsCompletePayPalOrders: 0,
            paymentsTotalPaid: 0,
            _avgSum: 0,
            _avgCount: 0,
          }
        }
        const bucket = agg[wk]
        for (const k of NUMERIC_KEYS) bucket[k] += Number((s as Snap)[k] ?? 0)
        if (typeof s.imageRequestsAvgQuantity === 'number' && Number.isFinite(s.imageRequestsAvgQuantity)) {
          bucket._avgSum += s.imageRequestsAvgQuantity
          bucket._avgCount += 1
        }
      }

      rows = weeks.map((wk) => {
        const x = agg[wk]
        if (!x) {
          // empty week row
          return {
            bucketStart: wk,
            usersSpentPointsGt0: 0,
            usersSpentOver100: 0,
            usersSpentOver1000: 0,
            usersSpentOver10000: 0,
            usersSpentOver20000: 0,
            usersPurchasedImage: 0,
            usersCreatedImage: 0,
            usersEmailVerified: 0,
            usersPhoneVerified: 0,
            usersInstagramVerified: 0,
            usersTwitterVerified: 0,
            usersSetUsername: 0,
            imagesTotalCreated: 0,
            imagesTotalUpscaled: 0,
            imageRequestsTotal: 0,
            imagesPurchased: 0,
            purchasesTotal: 0,
            imagesPrivate: 0,
            imagesInAtLeastOneCollection: 0,
            imagesCreationFailed: 0,
            collectionsCreated: 0,
            collectionsWithImages: 0,
            paymentsIncompletePayPalOrders: 0,
            paymentsCompletePayPalOrders: 0,
            paymentsTotalPaid: 0,
          }
        }
        const avg = x._avgCount > 0 ? x._avgSum / x._avgCount : undefined
        const { _avgSum: _a1, _avgCount: _a2, ...rest } = x
        const r: Row = { ...rest }
        if (typeof avg === 'number' && Number.isFinite(avg)) r.imageRequestsAvgQuantity = Number(avg.toFixed(4))
        return r
      })
    }

    const headers: (keyof Row)[] = ['bucketStart', ...NUMERIC_KEYS, 'imageRequestsAvgQuantity']
    let csv = headers.join(',') + '\n'
    for (const r of rows) {
      const lineParts: (string | number | null | undefined)[] = [
        r.bucketStart,
        ...NUMERIC_KEYS.map((k) => r[k]),
        r.imageRequestsAvgQuantity,
      ]
      csv += lineParts.map((v) => escapeCsv(v as string | number | null | undefined)).join(',') + '\n'
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date()
    const mode = groupBy.value === 'weekly' ? 'weekly' : 'daily'
    const fn = `stats-history-${mode}-${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}.csv`
    a.href = url
    a.download = fn
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    Notify.create({ message: `Exported ${rows.length.toLocaleString()} rows`, color: 'positive', icon: 'file_download' })
  } catch (e) {
    Notify.create({ message: 'Export failed', color: 'negative' })
  } finally {
    exportingHistory.value = false
  }
}
</script>

<style scoped>
</style>
