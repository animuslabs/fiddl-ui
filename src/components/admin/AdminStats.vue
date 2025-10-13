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
    q-btn(icon="refresh" label="Load" color="primary" unelevated @click="refreshAll" :loading="loadingHistory || loadingPaymentsHistory")

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
    q-btn(icon="refresh" flat @click="refreshPaymentsHistory" :loading="loadingPaymentsHistory")

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
import SimpleLineChart from './SimpleLineChart.vue'
import { statsUsers, statsImages, statsCollections, statsPayments, statsHistory, adminListPayments, type StatsUsers200, type StatsImages200, type StatsCollections200, type StatsPayments200, type AdminListPayments200ItemsItem } from 'src/lib/orval'

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

// Payments history by method (weekly)
const loadingPaymentsHistory = ref(false)
const paymentsByMethodWeekly = ref<Record<string, Record<string, number>>>({})

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

function isPaidStatus(status?: string | null): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  if (s.includes('fail') || s.includes('declin') || s.includes('error') || s.includes('cancel')) return false
  if (s.includes('pend') || s.includes('incom')) return false
  if (s.includes('succe') || s.includes('complet') || s.includes('paid')) return true
  return false
}

async function refreshPaymentsHistory() {
  try {
    loadingPaymentsHistory.value = true
    const fromISO = fromStr.value ? new Date(fromStr.value).toISOString() : undefined
    const toISO = toStr.value ? new Date(toStr.value).toISOString() : undefined
    const methods = ['payPal', 'crypto', 'stars']
    const result: Record<string, Record<string, number>> = {}
    for (const m of methods) {
      // page through results
      let offset = 0
      const pageLimit = 500
      const totals: Record<string, number> = {}
      // simple guard to avoid huge loops
      let safety = 0
      while (safety < 50) {
        safety++
        const res = await adminListPayments({
          limit: pageLimit,
          offset,
          method: m as any,
          startDateTime: fromISO,
          endDateTime: toISO,
        })
        const items: AdminListPayments200ItemsItem[] = res?.data?.items || []
        for (const it of items) {
          if (!isPaidStatus(it?.status)) continue
          const amt = Number(it?.amountUsd ?? 0)
          if (!Number.isFinite(amt) || amt <= 0) continue
          const d = new Date(it.createdAt)
          const wk = weekStartKey(d)
          totals[wk] = (totals[wk] || 0) + amt
        }
        if (items.length < pageLimit) break
        offset += items.length
      }
      result[m] = totals
    }
    paymentsByMethodWeekly.value = result
  } catch (e) {
    paymentsByMethodWeekly.value = {}
  } finally {
    loadingPaymentsHistory.value = false
  }
}

async function refreshAll() {
  await refreshHistory()
  await refreshPaymentsHistory()
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

const paymentMethodSeries = computed(() => {
  const fromISO = fromStr.value ? new Date(fromStr.value).toISOString() : undefined
  const toISO = toStr.value ? new Date(toStr.value).toISOString() : undefined
  const weeks = buildWeekKeys(fromISO, toISO)
  const methods = ['payPal', 'crypto', 'stars']
  return methods.map(m => {
    const wkMap = paymentsByMethodWeekly.value?.[m] || {}
    const values = weeks.map(wk => Number(wkMap[wk] || 0))
    return { key: m, label: `${m} (USD)`, values, color: paymentMethodColors[m] || '#1976d2' }
  })
})
</script>

<style scoped>
</style>
