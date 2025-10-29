<template lang="pug">
.q-pa-md.admin-stats
  // Live snapshot
  q-card(flat bordered class="q-mb-lg")
    q-card-section
      .row.items-center.q-gutter-sm
        h5.q-my-none Live Snapshot
        q-space
        q-btn(icon="refresh" flat @click="refreshLive" :loading="loadingLive")
    q-separator
    q-card-section
      .row.q-col-gutter-sm
        q-card.flat.bordered.col-12.col-sm-6.col-lg-3(v-for="card in liveSummaryCards" :key="card.key")
          q-card-section
            div.text-caption.text-grey-7 {{ card.label }}
            div.text-h5.kpi-value {{ card.value }}
            div.text-caption.text-grey-6(v-if="card.description") {{ card.description }}
    q-separator
    q-card-section
      .row.items-center.q-gutter-sm.q-mb-sm
        h6.q-my-none Live Activity (last hour)
      .row.q-col-gutter-sm
        q-card.flat.bordered.col-12.col-sm-6.col-lg-3(v-for="card in liveActivityCards" :key="card.key")
          q-card-section
            div.text-caption.text-grey-7 {{ card.label }}
            div.text-h6.kpi-value {{ card.value }}
            div.text-caption.text-grey-6(v-if="card.description") {{ card.description }}

  // Historical insights + filters
  q-card(flat bordered class="q-mb-lg")
    q-card-section
      .row.items-center.q-gutter-sm
        h5.q-my-none Historical Insights
        q-space
        q-btn(icon="download" label="Export CSV" color="primary" outline @click="exportHistoryCsv" :loading="exportingHistory")
        q-btn(icon="refresh" label="Load" color="primary" unelevated @click="refreshAll" :loading="loadingHistory || loadingWeekly || loadingAttribution")
    q-separator
    q-card-section
      .row.q-col-gutter-sm.filters-row
        .col-12.col-md-3
          q-btn-toggle(
            v-model="groupBy"
            :options="groupOptions"
            spread
            rounded
            toggle-color="primary"
            color="grey-5"
            dense
          )
        .col-12.col-sm-6.col-md-3
          q-input(v-model="fromStr" type="datetime-local" label="From" dense outlined clearable)
        .col-12.col-sm-6.col-md-3
          q-input(v-model="toStr" type="datetime-local" label="To" dense outlined clearable)
        .col-12.col-sm-6.col-md-2
          q-input(v-model.number="limit" type="number" label="Limit" dense outlined clearable :min="1" :max="365")
    q-card-section
      .row.q-col-gutter-sm
        q-card.flat.bordered.col-12.col-sm-6.col-lg-3(v-for="card in insightCards" :key="card.key")
          q-card-section
            div.text-caption.text-grey-7 {{ card.label }}
            div.text-h6.kpi-value {{ card.value }}
            div.text-caption.text-grey-6(v-if="card.description") {{ card.description }}
    q-separator
    q-card-section(v-if="hasHistoryData")
      h6.q-mb-md Revenue, Signups & Purchases
      ApexChart(:options="revenueUsersOptions" :series="revenueUsersSeries" height="340")
    q-card-section(v-else)
      .text-center.text-grey-7 No history data for selected range.

  // Conversion & retention
  q-card(flat bordered class="q-mb-lg")
    q-card-section
      .row.items-center.q-gutter-sm
        h5.q-my-none Conversion & Retention
        q-space
        div.text-caption.text-grey-6 Selected range conversion funnel
    q-separator
    q-card-section
      .row.q-col-gutter-sm
        .col-12.col-lg-6
          ApexChart(:options="conversionFunnelOptions" :series="conversionFunnelSeries" height="320")
        .col-12.col-lg-6
          .column.q-gutter-sm
            div(v-for="item in conversionInsights" :key="item.key" class="conversion-row")
              div.text-body1 {{ item.label }}
              div.text-caption.text-grey-7 {{ item.value }}

  // Magic Mirror & engagement
  q-card(flat bordered class="q-mb-lg")
    q-card-section
      .row.items-center.q-gutter-sm
        h5.q-my-none Engagement Signals
        q-space
        div.text-caption.text-grey-6 Magic Mirror adoption vs purchases
    q-separator
    q-card-section(v-if="hasHistoryData")
      ApexChart(:options="magicMirrorOptions" :series="magicMirrorSeries" height="300")
    q-card-section(v-else)
      .text-center.text-grey-7 No engagement data for selected range.

  // Attribution overview
  q-card(flat bordered class="q-mb-lg")
    q-card-section
      .row.items-center.q-gutter-sm
        h5.q-my-none Attribution Overview
        q-space
        q-select(
          v-model="attributionGroupBy"
          :options="attributionGroupOptions"
          option-label="label"
          option-value="value"
          label="Group by"
          dense outlined emit-value map-options
          style="min-width: 180px"
        )
        q-select(
          v-model="attributionMetric"
          :options="attributionMetricOptions"
          option-label="label"
          option-value="value"
          label="Metric"
          dense outlined emit-value map-options
          style="min-width: 160px"
        )
        q-input(
          v-model.number="attributionLimit"
          type="number"
          label="Top N"
          dense outlined
          :min="3"
          :max="50"
          style="max-width: 120px"
        )
    q-separator
    q-card-section(v-if="attributionItems.length")
      ApexChart(:options="attributionOptions" :series="attributionSeries" height="360" :key="attributionChartKey")
    q-card-section(v-else)
      .row.justify-center
        q-spinner(color="primary" size="32px" v-if="loadingAttribution")
        .text-grey-7(v-else) No attribution data for selected range.

  // Weekly trends
  q-card(flat bordered)
    q-card-section
      .row.items-center.q-gutter-sm
        h5.q-my-none Weekly Trends
        q-space
        q-input(v-model.number="weeklyWeeks" type="number" label="Weeks" dense outlined clearable style="max-width: 120px")
        q-input(v-model="weeklyEndStr" type="datetime-local" label="End At" dense outlined clearable style="min-width: 200px")
        q-btn(icon="refresh" flat @click="refreshWeekly" :loading="loadingWeekly")
    q-separator
    q-card-section(v-if="weeklyBuckets.length")
      h6.q-mb-md Active Users vs Revenue
      ApexChart(:options="weeklyOverviewOptions" :series="weeklyOverviewSeries" height="320")
    q-card-section(v-if="weeklyBuckets.length")
      h6.q-mt-lg.q-mb-md Payment Methods Mix
      ApexChart(:options="weeklyPaymentOptions" :series="weeklyPaymentSeries" height="320")
    q-card-section(v-else)
      .text-center.text-grey-7 No weekly data for selected range.
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Notify } from 'quasar'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type {
  AdminAttributionGroups200,
  AdminAttributionGroups200ItemsItem,
  AdminAttributionGroupsGroupBy,
  AdminAttributionGroupsParams,
  AdminAttributionGroupsSortDir,
  StatsActivity200,
  StatsCollections200,
  StatsHistory200,
  StatsHistory200SnapshotsItem,
  StatsHistoryParams,
  StatsImages200,
  StatsPayments200,
  StatsUsers200,
  StatsWeekly200,
  StatsWeekly200BucketsItem,
} from 'src/lib/orval'
import {
  adminAttributionGroups,
  statsActivity,
  statsCollections,
  statsHistory,
  statsImages,
  statsPayments,
  statsUsers,
  statsWeekly,
} from 'src/lib/orval'

const ApexChart = VueApexCharts

type GroupByMode = 'daily' | 'weekly'

const HISTORY_NUMERIC_KEYS = [
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
  'newUsersHourly',
  'imagePurchasesHourly',
  'videoPurchasesHourly',
  'magicMirrorUsesHourly',
  'paymentsUsdHourly',
  'paymentsPayPalUsdHourly',
  'paymentsCryptoUsdHourly',
  'paymentsStarsUsdHourly',
  'freeCreditsSocialLinksDaily',
  'freeCreditsMissionsDaily',
  'freeCreditsUnlocksDaily',
  'freeCreditsReferralsDaily',
  'freeCreditsPromoCodesDaily',
  'freeCreditsRefundsDaily',
  'freeCreditsOtherDaily',
] as const

type HistoryNumericKey = (typeof HISTORY_NUMERIC_KEYS)[number]

type ChartHistoryBucket = StatsHistory200SnapshotsItem & { bucketDate: Date }

const currencyFormatter0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const currencyFormatter2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percentFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const loadingLive = ref(false)
const loadingHistory = ref(false)
const loadingWeekly = ref(false)
const loadingAttribution = ref(false)
const exportingHistory = ref(false)

const live = ref<{
  users: StatsUsers200
  images: StatsImages200
  collections: StatsCollections200
  payments: StatsPayments200
  activity: StatsActivity200 | null
}>({
  users: {
    asOf: '',
    spentPoints: 0,
    spentOver100Points: 0,
    spentOver1000Points: 0,
    spentOver10000Points: 0,
    spentOver20000Points: 0,
    purchasedImage: 0,
    createdImage: 0,
    emailVerified: 0,
    phoneVerified: 0,
    instagramVerified: 0,
    twitterVerified: 0,
    setUsername: 0,
  },
  images: {
    asOf: '',
    totalCreated: 0,
    totalUpscaled: 0,
    totalImageCreateRequests: 0,
    averageImageQuantityPerCreateRequest: { _avg: { quantity: null } },
    purchasedImages: 0,
    totalPurchases: 0,
    privateImages: 0,
    imagesInAtLeastOneCollection: 0,
    imageCreationFailed: 0,
  },
  collections: {
    asOf: '',
    collectionsCreated: 0,
    emptyCollections: 0,
  },
  payments: {
    asOf: '',
    incompletePayPayPalOrders: 0,
    completePayPayPalOrders: 0,
    paypalOrdersTotalPaid: { _sum: { amount: null } },
  },
  activity: null,
})

const history = ref<StatsHistory200>({ snapshots: [] })
const weekly = ref<StatsWeekly200>({ buckets: [] })
const attribution = ref<AdminAttributionGroups200>({ total: 0, items: [] })

const groupBy = ref<GroupByMode>('weekly')
const groupOptions = [
  { label: 'Daily', value: 'daily' as GroupByMode },
  { label: 'Weekly', value: 'weekly' as GroupByMode },
]

const fromStr = ref<string | null>(defaultFrom())
const toStr = ref<string | null>(null)
const limit = ref<number | null>(90)

const weeklyWeeks = ref<number>(12)
const weeklyEndStr = ref<string | null>(null)

const attributionGroupBy = ref<AdminAttributionGroupsGroupBy>('utmSource')
const attributionMetric = ref<'usdTotal' | 'users' | 'paidUsers'>('usdTotal')
const attributionLimit = ref<number>(10)

const attributionGroupOptions = [
  { label: 'UTM Source', value: 'utmSource' as AdminAttributionGroupsGroupBy },
  { label: 'UTM Medium', value: 'utmMedium' as AdminAttributionGroupsGroupBy },
  { label: 'UTM Campaign', value: 'utmCampaign' as AdminAttributionGroupsGroupBy },
  { label: 'Referrer Domain', value: 'referrerDomain' as AdminAttributionGroupsGroupBy },
  { label: 'Landing Domain', value: 'landingDomain' as AdminAttributionGroupsGroupBy },
  { label: 'Survey Result', value: 'surveyResult' as AdminAttributionGroupsGroupBy },
  { label: 'Survey Other', value: 'surveyResultOther' as AdminAttributionGroupsGroupBy },
  { label: 'Source', value: 'source' as AdminAttributionGroupsGroupBy },
]

const attributionMetricOptions = [
  { label: 'Revenue (USD)', value: 'usdTotal' as const },
  { label: 'Total Users', value: 'users' as const },
  { label: 'Paid Users', value: 'paidUsers' as const },
]

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  const s = d.toISOString()
  return s.slice(0, 16)
}

const liveSummaryCards = computed(() => [
  {
    key: 'users_spent',
    label: 'Users Spent > 0',
    value: formatNumber(live.value.users.spentPoints),
    description: `${formatNumber(live.value.users.spentOver100Points)} spent over 100 points`,
  },
  {
    key: 'images_created',
    label: 'Images Created',
    value: formatNumber(live.value.images.totalCreated),
    description: `${formatNumber(live.value.images.totalUpscaled)} upscaled`,
  },
  {
    key: 'collections',
    label: 'Collections Created',
    value: formatNumber(live.value.collections.collectionsCreated),
    description: `${formatNumber(live.value.collections.emptyCollections)} empty`,
  },
  {
    key: 'payments_paid',
    label: 'Total Paid (USD)',
    value: formatUsd(live.value.payments.paypalOrdersTotalPaid?._sum?.amount ?? 0),
    description: `${formatNumber(live.value.payments.completePayPayPalOrders)} completed orders`,
  },
])

const liveActivityCards = computed(() => {
  const activity = live.value.activity
  return [
    {
      key: 'activity-new-users',
      label: 'New Users (60m)',
      value: formatNumber(activity?.newUsersHourly),
      description: 'Latest hourly cohort',
    },
    {
      key: 'activity-purchases',
      label: 'Purchases (60m)',
      value: formatNumber(activity?.totalPurchasesHourly ?? activity?.imagePurchasesHourly ?? 0),
      description: `${formatNumber(activity?.imagePurchasesHourly)} image / ${formatNumber(activity?.videoPurchasesHourly)} video`,
    },
    {
      key: 'activity-magic-mirror',
      label: 'Magic Mirror Uses (60m)',
      value: formatNumber(activity?.magicMirrorUsesHourly),
    },
    {
      key: 'activity-revenue',
      label: 'Revenue Last Hour',
      value: formatUsd(activity?.paymentsUsdHourly ?? 0, 2),
      description: `PayPal ${formatUsd(activity?.paymentsPayPalUsdHourly ?? 0, 2)}`,
    },
  ]
})

const historyBuckets = computed<ChartHistoryBucket[]>(() => {
  const raw = Array.isArray(history.value?.snapshots) ? history.value.snapshots : []
  if (!raw.length) return []
  return normaliseSnapshots(raw, groupBy.value, fromStr.value, toStr.value)
})

const hasHistoryData = computed(() => historyBuckets.value.length > 0)

const historyTotals = computed<Record<HistoryNumericKey, number>>(() => {
  const totals = {} as Record<HistoryNumericKey, number>
  for (const key of HISTORY_NUMERIC_KEYS) totals[key] = 0
  for (const bucket of historyBuckets.value) {
    for (const key of HISTORY_NUMERIC_KEYS) {
      totals[key] += Number(bucket[key] ?? 0)
    }
  }
  return totals
})

const averageImageRequestQuantity = computed(() => {
  const values = historyBuckets.value
    .map((b) => (typeof b.imageRequestsAvgQuantity === 'number' ? b.imageRequestsAvgQuantity : null))
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!values.length) return 0
  const sum = values.reduce((acc, v) => acc + v, 0)
  return sum / values.length
})

const rangeSummary = computed(() => {
  const totals = historyTotals.value
  const totalSignups = totals.usersSetUsername
  const totalCreators = totals.usersCreatedImage
  const totalSpenders = totals.usersSpentPointsGt0
  const totalPurchasers = totals.usersPurchasedImage
  const totalPurchases = totals.purchasesTotal
  const totalRevenueUsd = totals.paymentsTotalPaid
  const totalMagicMirrorUses = totals.magicMirrorUsesHourly
  const totalNewUsers = totals.newUsersHourly
  const baseForMirror = Math.max(totalSignups, totalCreators)
  const magicMirrorPercent = baseForMirror > 0 ? Math.min(100, (totalMagicMirrorUses / baseForMirror) * 100) : 0
  const purchasePercent = totalSignups > 0 ? (totalPurchasers / totalSignups) * 100 : 0
  const paidPercent = totalSignups > 0 ? (totalSpenders / totalSignups) * 100 : 0
  const revenuePerSignup = totalSignups > 0 ? totalRevenueUsd / totalSignups : 0
  const avgOrderValue = totalPurchases > 0 ? totalRevenueUsd / totalPurchases : 0
  const repeatPurchaseShare =
    totalPurchases > 0 ? Math.max(0, totalPurchases - totalPurchasers) / totalPurchases * 100 : 0
  const revenuePerPurchaser = totalPurchasers > 0 ? totalRevenueUsd / totalPurchasers : 0
  const purchasesPerPurchaser = totalPurchasers > 0 ? totalPurchases / totalPurchasers : 0

  return {
    totalRevenueUsd,
    totalSignups,
    totalCreators,
    totalSpenders,
    totalPurchasers,
    totalPurchases,
    totalMagicMirrorUses,
    totalNewUsers,
    revenuePerSignup,
    avgOrderValue,
    purchasePercent,
    paidPercent,
    magicMirrorPercent,
    repeatPurchaseShare,
    revenuePerPurchaser,
    purchasesPerPurchaser,
  }
})

const insightCards = computed(() => [
  {
    key: 'total-revenue',
    label: 'Revenue (USD)',
    value: formatUsd(rangeSummary.value.totalRevenueUsd),
  },
  {
    key: 'new-signups',
    label: 'New Signups',
    value: formatNumber(rangeSummary.value.totalSignups),
    description: `${formatNumber(rangeSummary.value.totalNewUsers)} hourly signups`,
  },
  {
    key: 'revenue-per-signup',
    label: 'Revenue per Signup',
    value: formatUsd(rangeSummary.value.revenuePerSignup, 2),
  },
  {
    key: 'purchase-conversion',
    label: 'Purchase Conversion',
    value: formatPercent(rangeSummary.value.purchasePercent),
    description: `${formatNumber(rangeSummary.value.totalPurchasers)} purchasers`,
  },
  {
    key: 'paid-conversion',
    label: 'Paid Plan Conversion',
    value: formatPercent(rangeSummary.value.paidPercent),
    description: `${formatNumber(rangeSummary.value.totalSpenders)} spent points`,
  },
  {
    key: 'magic-mirror-adoption',
    label: 'Magic Mirror Adoption',
    value: formatPercent(rangeSummary.value.magicMirrorPercent),
    description: `${formatNumber(rangeSummary.value.totalMagicMirrorUses)} uses`,
  },
  {
    key: 'repeat-purchase-share',
    label: 'Repeat Purchase Share',
    value: formatPercent(rangeSummary.value.repeatPurchaseShare),
    description: `${formatNumber(rangeSummary.value.totalPurchases)} purchases`,
  },
  {
    key: 'average-order-value',
    label: 'Average Order Value',
    value: formatUsd(rangeSummary.value.avgOrderValue, 2),
  },
  {
    key: 'lifetime-value',
    label: 'Revenue per Purchaser',
    value: formatUsd(rangeSummary.value.revenuePerPurchaser, 2),
    description: `${formatNumber(rangeSummary.value.purchasesPerPurchaser)} orders per purchaser`,
  },
  {
    key: 'avg-request-size',
    label: 'Avg Images per Request',
    value: formatNumber(averageImageRequestQuantity.value, 2),
  },
])

const revenueUsersSeries = computed(() => [
  {
    name: 'Revenue (USD)',
    type: 'column',
    data: buildSeriesData('paymentsTotalPaid'),
  },
  {
    name: 'Signups',
    type: 'line',
    data: buildSeriesData('usersSetUsername'),
  },
  {
    name: 'Purchases',
    type: 'line',
    data: buildSeriesData('purchasesTotal'),
  },
])

const revenueUsersOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'line',
    toolbar: { show: false },
    foreColor: '#5f6368',
  },
  stroke: { width: [0, 3, 3], curve: 'smooth' },
  dataLabels: { enabled: false },
  plotOptions: {
    bar: { columnWidth: '55%', borderRadius: 6 },
  },
  xaxis: {
    type: 'datetime',
  },
  yaxis: [
    {
      title: { text: 'Revenue (USD)' },
      labels: { formatter: (v: number) => formatNumber(v) },
    },
    {
      opposite: true,
      title: { text: 'Users / Purchases' },
      labels: { formatter: (v: number) => formatNumber(v) },
    },
  ],
  colors: ['#1976D2', '#26A69A', '#FFB300'],
  tooltip: {
    shared: true,
    x: { format: groupBy.value === 'daily' ? 'MMM dd' : 'MMM dd, yyyy' },
    y: {
      formatter: (val: number, opts) => {
        if (opts.seriesIndex === 0) return formatUsd(val, 2)
        return formatNumber(val)
      },
    },
  },
  legend: { position: 'top' },
}))

const conversionFunnel = computed(() => [
  { key: 'signups', label: 'Signups', value: rangeSummary.value.totalSignups },
  { key: 'creators', label: 'Creators', value: rangeSummary.value.totalCreators },
  { key: 'spenders', label: 'Spent Points', value: rangeSummary.value.totalSpenders },
  { key: 'purchasers', label: 'Purchasers', value: rangeSummary.value.totalPurchasers },
])

const conversionFunnelSeries = computed(() => [
  {
    name: 'Users',
    data: conversionFunnel.value.map((stage) => stage.value),
  },
])

const conversionFunnelOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false }, foreColor: '#5f6368' },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 6,
      barHeight: '60%',
    },
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => formatNumber(val),
  },
  xaxis: {
    categories: conversionFunnel.value.map((stage) => stage.label),
    labels: { formatter: (value: string) => formatNumber(Number(value)) },
  },
  colors: ['#26A69A'],
}))

const conversionInsights = computed(() => {
  const stages = conversionFunnel.value
  const [signups = 0, creators = 0, spenders = 0, purchasers = 0] = stages.map((stage) => stage.value)
  const creatorRate = signups > 0 ? (creators / signups) * 100 : 0
  const spenderRate = creators > 0 ? (spenders / creators) * 100 : 0
  const purchaserRate = spenders > 0 ? (purchasers / spenders) * 100 : 0
  const overallRate = signups > 0 ? (purchasers / signups) * 100 : 0
  const averageOrders = rangeSummary.value.purchasesPerPurchaser

  return [
    { key: 'stage-creator', label: 'Creators from signups', value: formatPercent(creatorRate) },
    { key: 'stage-spender', label: 'Spend points after creating', value: formatPercent(spenderRate) },
    { key: 'stage-purchaser', label: 'Purchasers after spending', value: formatPercent(purchaserRate) },
    { key: 'stage-overall', label: 'Signup to purchaser', value: formatPercent(overallRate) },
    { key: 'orders-per-purchaser', label: 'Orders per purchaser', value: formatNumber(averageOrders, 2) },
  ]
})

const magicMirrorSeries = computed(() => [
  { name: 'Magic Mirror Uses', data: buildSeriesData('magicMirrorUsesHourly') },
  { name: 'Image Purchases', data: buildSeriesData('imagePurchasesHourly') },
])

const magicMirrorOptions = computed<ApexOptions>(() => ({
  chart: { type: 'line', toolbar: { show: false }, foreColor: '#5f6368' },
  stroke: { curve: 'smooth', width: 3 },
  dataLabels: { enabled: false },
  xaxis: { type: 'datetime' },
  colors: ['#8E24AA', '#FF7043'],
  tooltip: {
    shared: true,
    x: { format: groupBy.value === 'daily' ? 'MMM dd' : 'MMM dd, yyyy' },
    y: { formatter: (val: number) => formatNumber(val) },
  },
  legend: { position: 'top' },
}))

const weeklyBuckets = computed<StatsWeekly200BucketsItem[]>(() =>
  Array.isArray(weekly.value?.buckets) ? weekly.value.buckets : []
)

const weeklyOverviewSeries = computed(() => [
  {
    name: 'Revenue (USD)',
    type: 'column',
    data:
      weeklyBuckets.value.map((bucket) => ({
        x: new Date(bucket.weekStart).getTime(),
        y: Number(bucket.payments?.totalUsd ?? 0),
      })) ?? [],
  },
  {
    name: 'Active Users',
    type: 'line',
    data:
      weeklyBuckets.value.map((bucket) => ({
        x: new Date(bucket.weekStart).getTime(),
        y: Number(bucket.activeUsers ?? 0),
      })) ?? [],
  },
])

const weeklyOverviewOptions = computed<ApexOptions>(() => ({
  chart: { type: 'line', toolbar: { show: false }, foreColor: '#5f6368' },
  stroke: { width: [0, 3], curve: 'smooth' },
  dataLabels: { enabled: false },
  plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
  xaxis: { type: 'datetime' },
  yaxis: [
    { title: { text: 'Revenue (USD)' }, labels: { formatter: (val: number) => formatNumber(val) } },
    {
      opposite: true,
      title: { text: 'Active Users' },
      labels: { formatter: (val: number) => formatNumber(val) },
    },
  ],
  colors: ['#1E88E5', '#43A047'],
  tooltip: {
    shared: true,
    x: { format: 'MMM dd, yyyy' },
    y: {
      formatter: (val: number, opts) => (opts.seriesIndex === 0 ? formatUsd(val, 2) : formatNumber(val)),
    },
  },
}))

const weeklyPaymentSeries = computed(() => {
  const categories = weeklyBuckets.value.map((bucket) => new Date(bucket.weekStart).getTime())
  const payPal = categories.map((_, idx) =>
    Number(weeklyBuckets.value[idx]?.payments?.byMethod?.payPal ?? 0)
  )
  const crypto = categories.map((_, idx) =>
    Number(weeklyBuckets.value[idx]?.payments?.byMethod?.crypto ?? 0)
  )
  const stars = categories.map((_, idx) =>
    Number(weeklyBuckets.value[idx]?.payments?.byMethod?.stars ?? 0)
  )
  return [
    { name: 'PayPal', data: zipWith(categories, payPal) },
    { name: 'Crypto', data: zipWith(categories, crypto) },
    { name: 'Stars', data: zipWith(categories, stars) },
  ]
})

const weeklyPaymentOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', stacked: true, toolbar: { show: false }, foreColor: '#5f6368' },
  plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
  dataLabels: { enabled: false },
  xaxis: { type: 'datetime' },
  yaxis: { labels: { formatter: (val: number) => formatUsd(val, 0) } },
  colors: ['#0D47A1', '#00897B', '#FFB300'],
  tooltip: { y: { formatter: (val: number) => formatUsd(val, 2) } },
  legend: { position: 'top' },
}))

const attributionItems = computed<AdminAttributionGroups200ItemsItem[]>(() =>
  Array.isArray(attribution.value?.items) ? attribution.value.items : []
)

const attributionCategories = computed(() =>
  attributionItems.value.map((item) => (item.key && item.key.length ? item.key : 'Unknown'))
)

const attributionSeries = computed(() => {
  const metric = attributionMetric.value
  const values = attributionItems.value.map((item) => {
    if (metric === 'usdTotal') return Number(item.usdTotal ?? 0)
    if (metric === 'users') return Number(item.users ?? 0)
    return Number(item.paidUsers ?? 0)
  })
  return [
    {
      name: metric === 'usdTotal' ? 'Revenue (USD)' : metric === 'users' ? 'Users' : 'Paid Users',
      data: values,
    },
  ]
})

const attributionOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false }, foreColor: '#5f6368' },
  plotOptions: { bar: { horizontal: true, borderRadius: 6 } },
  dataLabels: { enabled: true, formatter: (val: number) => (isRevenueMetric() ? formatUsd(val, 2) : formatNumber(val)) },
  xaxis: {
    categories: attributionCategories.value,
    labels: {
      formatter: (value: string) =>
        isRevenueMetric() ? formatUsd(Number(value), 0) : formatNumber(Number(value)),
    },
  },
  colors: ['#3949AB'],
  tooltip: {
    y: { formatter: (val: number) => (isRevenueMetric() ? formatUsd(val, 2) : formatNumber(val)) },
  },
  legend: { show: false },
}))

const attributionChartKey = computed(
  () => `${attributionMetric.value}-${attributionGroupBy.value}-${attributionItems.value.length}`
)

function isRevenueMetric(): boolean {
  return attributionMetric.value === 'usdTotal'
}

function buildSeriesData(key: HistoryNumericKey) {
  return historyBuckets.value.map((bucket) => ({
    x: bucket.bucketDate.getTime(),
    y: Number(bucket[key] ?? 0),
  }))
}

function zipWith<T>(categories: number[], values: number[]): { x: number; y: number }[] {
  return categories.map((cat, idx) => ({
    x: cat,
    y: Number(values[idx] ?? 0),
  }))
}

function formatNumber(value?: number | null, fractionDigits = 0): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  if (fractionDigits > 0) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n)
  }
  return integerFormatter.format(n)
}

function formatUsd(value?: number | null, fractionDigits = 0): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return fractionDigits >= 2 ? currencyFormatter2.format(n) : currencyFormatter0.format(n)
}

function formatPercent(value?: number | null): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return `${percentFormatter.format(n)}%`
}

async function refreshLive() {
  try {
    loadingLive.value = true
    const [u, i, c, p, a] = await Promise.all([
      statsUsers(),
      statsImages(),
      statsCollections(),
      statsPayments(),
      statsActivity(),
    ])
    live.value.users = u?.data ?? live.value.users
    live.value.images = i?.data ?? live.value.images
    live.value.collections = c?.data ?? live.value.collections
    live.value.payments = p?.data ?? live.value.payments
    live.value.activity = a?.data ?? live.value.activity
  } catch (err) {
    console.error(err)
  } finally {
    loadingLive.value = false
  }
}

async function refreshHistory() {
  try {
    loadingHistory.value = true
    const params: StatsHistoryParams = {}
    if (fromStr.value) params.from = new Date(fromStr.value).toISOString()
    if (toStr.value) params.to = new Date(toStr.value).toISOString()
    if (limit.value && Number(limit.value) > 0) params.limit = Number(limit.value)
    const res = await statsHistory(params)
    history.value = res?.data ?? { snapshots: [] }
  } catch (err) {
    history.value = { snapshots: [] }
    console.error(err)
  } finally {
    loadingHistory.value = false
  }
}

async function refreshWeekly() {
  try {
    loadingWeekly.value = true
    const params: Parameters<typeof statsWeekly>[0] = {}
    if (weeklyWeeks.value && Number(weeklyWeeks.value) > 0) params.weeks = Number(weeklyWeeks.value)
    if (weeklyEndStr.value) params.endAt = new Date(weeklyEndStr.value).toISOString()
    const res = await statsWeekly(params)
    weekly.value = res?.data ?? { buckets: [] }
  } catch (err) {
    weekly.value = { buckets: [] }
    console.error(err)
  } finally {
    loadingWeekly.value = false
  }
}

async function refreshAttribution() {
  try {
    loadingAttribution.value = true
    const params: AdminAttributionGroupsParams = {
      groupBy: attributionGroupBy.value,
      sortDir: 'desc' as AdminAttributionGroupsSortDir,
      orderBy: attributionOrder(attributionMetric.value),
      limit: Math.min(Math.max(Number(attributionLimit.value) || 10, 3), 50),
      includeUnknown: true,
    }
    if (fromStr.value) params.startDateTime = new Date(fromStr.value).toISOString()
    if (toStr.value) params.endDateTime = new Date(toStr.value).toISOString()
    const res = await adminAttributionGroups(params)
    attribution.value = res?.data ?? { total: 0, items: [] }
  } catch (err) {
    attribution.value = { total: 0, items: [] }
    console.error(err)
  } finally {
    loadingAttribution.value = false
  }
}

function attributionOrder(metric: typeof attributionMetric.value) {
  if (metric === 'usdTotal') return 'usdTotal'
  if (metric === 'users') return 'users'
  return 'paidUsers'
}

async function refreshAll() {
  await Promise.all([refreshHistory(), refreshWeekly(), refreshAttribution()])
}

async function exportHistoryCsv() {
  if (exportingHistory.value) return
  exportingHistory.value = true
  try {
    const params: StatsHistoryParams = {}
    if (fromStr.value) params.from = new Date(fromStr.value).toISOString()
    if (toStr.value) params.to = new Date(toStr.value).toISOString()
    if (limit.value && Number(limit.value) > 0) params.limit = Number(limit.value)
    const res = await statsHistory(params)
    const snapsRaw: StatsHistory200SnapshotsItem[] = Array.isArray(res?.data?.snapshots)
      ? (res!.data!.snapshots as StatsHistory200SnapshotsItem[])
      : []
    const buckets = normaliseSnapshots(snapsRaw, groupBy.value, params.from, params.to)
    const headers = ['bucketStart', ...HISTORY_NUMERIC_KEYS, 'imageRequestsAvgQuantity']
    let csv = headers.join(',') + '\n'
    for (const bucket of buckets) {
      const row: (string | number | null)[] = [
        bucket.bucketStart,
        ...HISTORY_NUMERIC_KEYS.map((key) => bucket[key]),
        bucket.imageRequestsAvgQuantity ?? '',
      ]
      csv += row.map((v) => escapeCsv(v)).join(',') + '\n'
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date()
    const mode = groupBy.value === 'weekly' ? 'weekly' : 'daily'
    const fn = `stats-history-${mode}-${formatTimestamp(ts)}.csv`
    a.href = url
    a.download = fn
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    Notify.create({ message: `Exported ${buckets.length.toLocaleString()} rows`, color: 'positive', icon: 'file_download' })
  } catch (err) {
    console.error(err)
    Notify.create({ message: 'Export failed', color: 'negative', icon: 'error' })
  } finally {
    exportingHistory.value = false
  }
}

function escapeCsv(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val)
  const needsQuotes = /[",\n]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function formatTimestamp(ts: Date): string {
  const yyyy = ts.getFullYear()
  const mm = String(ts.getMonth() + 1).padStart(2, '0')
  const dd = String(ts.getDate()).padStart(2, '0')
  const hh = String(ts.getHours()).padStart(2, '0')
  const mi = String(ts.getMinutes()).padStart(2, '0')
  const ss = String(ts.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

function normaliseSnapshots(
  snaps: StatsHistory200SnapshotsItem[],
  mode: GroupByMode,
  fromISO?: string | null,
  toISO?: string | null
): ChartHistoryBucket[] {
  if (!snaps.length) return []
  if (mode === 'daily') {
    return snaps.map((snap) => {
      const bucket = createEmptyBucket(snap.bucketStart)
      for (const key of HISTORY_NUMERIC_KEYS) {
        bucket[key] = Number((snap as Record<string, unknown>)[key] ?? 0)
      }
      bucket.imageRequestsAvgQuantity =
        typeof snap.imageRequestsAvgQuantity === 'number' && Number.isFinite(snap.imageRequestsAvgQuantity)
          ? Number(snap.imageRequestsAvgQuantity)
          : null
      return bucket
    })
  }

  const firstSnapshot = snaps[0]!
  const lastSnapshot = snaps[snaps.length - 1]!
  const weeks = buildWeekKeys(fromISO ?? firstSnapshot.bucketStart, toISO ?? lastSnapshot.bucketStart)
  const aggregates: Record<string, { sums: Record<HistoryNumericKey, number>; avgSum: number; avgCount: number }> = {}

  const ensureAggregate = (wk: string) => {
    if (!aggregates[wk]) {
      aggregates[wk] = { sums: {} as Record<HistoryNumericKey, number>, avgSum: 0, avgCount: 0 }
      for (const key of HISTORY_NUMERIC_KEYS) {
        aggregates[wk].sums[key] = 0
      }
    }
    return aggregates[wk]
  }

  for (const snap of snaps) {
    const wk = weekStartKey(new Date(snap.bucketStart))
    const agg = ensureAggregate(wk)
    for (const key of HISTORY_NUMERIC_KEYS) {
      agg.sums[key] += Number((snap as Record<string, unknown>)[key] ?? 0)
    }
    if (typeof snap.imageRequestsAvgQuantity === 'number' && Number.isFinite(snap.imageRequestsAvgQuantity)) {
      agg.avgSum += snap.imageRequestsAvgQuantity
      agg.avgCount += 1
    }
  }

  return weeks.map((wk) => {
    const iso = `${wk}T00:00:00.000Z`
    const bucket = createEmptyBucket(iso)
    const agg = aggregates[wk]
    if (agg) {
      for (const key of HISTORY_NUMERIC_KEYS) {
        bucket[key] = agg.sums[key]
      }
      bucket.imageRequestsAvgQuantity = agg.avgCount > 0 ? Number((agg.avgSum / agg.avgCount).toFixed(4)) : null
    }
    return bucket
  })
}

function createEmptyBucket(bucketStart: string): ChartHistoryBucket {
  const bucket = {
    bucketStart,
    bucketDate: new Date(bucketStart),
    imageRequestsAvgQuantity: null,
  } as ChartHistoryBucket
  for (const key of HISTORY_NUMERIC_KEYS) {
    bucket[key] = 0
  }
  return bucket
}

function weekStartKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay() || 7
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1))
  const yyyy = x.getUTCFullYear()
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(x.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function buildWeekKeys(fromISO?: string | null, toISO?: string | null): string[] {
  const start = fromISO ? new Date(fromISO) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const end = toISO ? new Date(toISO) : new Date()
  const keys: string[] = []
  let cur = new Date(start)
  cur = new Date(weekStartKey(cur) + 'T00:00:00.000Z')
  while (cur <= end) {
    keys.push(weekStartKey(cur))
    cur.setUTCDate(cur.getUTCDate() + 7)
  }
  return keys
}

onMounted(async () => {
  await refreshLive()
  await refreshAll()
})

watch([fromStr, toStr], async () => {
  await refreshAll()
})

watch(groupBy, async () => {
  await refreshHistory()
})

watch([attributionGroupBy, attributionMetric], async () => {
  await refreshAttribution()
})

watch(attributionLimit, async () => {
  await refreshAttribution()
})
</script>

<style scoped>
.admin-stats {
  max-width: 1600px;
  margin: 0 auto;
}

.kpi-value {
  font-variant-numeric: tabular-nums;
}

.filters-row {
  align-items: flex-end;
}

.conversion-row {
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}
</style>
