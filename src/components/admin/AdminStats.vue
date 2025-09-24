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
    q-input(v-model="fromStr" type="datetime-local" label="From" dense outlined clearable style="min-width:220px")
    q-input(v-model="toStr" type="datetime-local" label="To" dense outlined clearable style="min-width:220px")
    q-input(v-model.number="limit" type="number" label="Limit" dense outlined clearable style="width:120px")
    q-btn(icon="refresh" label="Load" color="primary" unelevated @click="refreshHistory" :loading="loadingHistory")

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
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import SimpleLineChart from './SimpleLineChart.vue'
import { statsUsers, statsImages, statsCollections, statsPayments, statsHistory, type StatsUsers200, type StatsImages200, type StatsCollections200, type StatsPayments200 } from 'src/lib/orval'

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

const historySeries = computed<Record<string, number[]>>(() => {
  const map: Record<string, number[]> = {}
  const snaps = Array.isArray(history.value?.snapshots) ? history.value.snapshots : []
  for (const m of metricsToShow) {
    map[m.key] = snaps.map((s: any) => Number(s?.[m.key] ?? 0))
  }
  return map
})

const totalHistoryPoints = computed(() => Object.values(historySeries.value)[0]?.length || 0)
const latestValue = (arr?: number[]) => (arr && arr.length ? arr[arr.length - 1] : 0)

onMounted(async () => {
  await refreshLive()
  await refreshHistory()
})
</script>

<style scoped>
</style>
