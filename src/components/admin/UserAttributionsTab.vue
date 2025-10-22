<template lang="pug">
.q-pa-sm
  // Controls
  .row.items-center.q-col-gutter-sm.q-mb-sm
    q-select(
      v-model="groupBy"
      :options="groupByOptions"
      label="Group By"
      dense outlined emit-value map-options option-label="label" option-value="value"
      style="min-width: 180px"
    )
    q-select(
      v-model="orderBy"
      :options="orderByOptions"
      label="Order By"
      dense outlined emit-value map-options option-label="label" option-value="value"
      style="min-width: 180px"
    )
    q-btn-toggle(v-model="sortDir" :options="sortDirOptions" dense unelevated size="sm")
    q-input(v-model="search" debounce="400" placeholder="Search (user id, username, key)" dense outlined clearable style="min-width:260px")
    q-toggle(v-model="includeUnknown" label="Include unknown" dense)
    q-input(v-model="start" type="datetime-local" label="Start" dense outlined clearable style="min-width:220px")
    q-input(v-model="end" type="datetime-local" label="End" dense outlined clearable style="min-width:220px")
    q-space
    q-btn(icon="refresh" flat @click="refetch" :loading="isFetching")

  .text-caption.text-grey-5.q-mb-xs {{ tableSummary }}
  .text-caption.text-grey-6.q-mb-sm(v-if="groupBySummary") {{ groupBySummary }}

  q-table(
    :rows="rows"
    :columns="columns"
    row-key="key"
    :loading="isLoading || isFetching"
    v-model:pagination="pagination"
    :rows-number="total"
    @request="onRequest"
    binary-state-sort
    flat bordered dense
    :rows-per-page-options="[10,25,50,100,0]"
    :no-data-label="'No attribution data'"
  )
    template(#header="props")
      q-tr(:props="props")
        q-th(v-for="col in props.cols" :key="col.name" :props="props")
          span {{ col.label }}
          q-icon(
            v-if="col.help"
            name="info_outline"
            size="16px"
            class="q-ml-xs text-grey-5"
          )
            q-tooltip(anchor="top middle" self="bottom middle" class="text-body2")
              | {{ col.help }}
    template(#body-cell-key="props")
      q-td(:props="props")
        span(v-if="props.row.key") {{ props.row.key }}
        q-chip(v-else color="grey-6" text-color="white" size="sm" label="Unknown")
    template(#body-cell-firstSignup="props")
      q-td(:props="props") {{ props.row.firstSignup ? new Date(props.row.firstSignup).toLocaleDateString() : '' }}
    template(#body-cell-lastSignup="props")
      q-td(:props="props") {{ props.row.lastSignup ? new Date(props.row.lastSignup).toLocaleDateString() : '' }}
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { QTableColumn } from 'quasar'
import { useAdminAttributionGroups, AdminAttributionGroupsGroupBy, AdminAttributionGroupsOrderBy, AdminAttributionGroupsSortDir } from 'src/lib/orval'

type TablePagination = { sortBy: string; descending: boolean; page: number; rowsPerPage: number }

const groupBy = ref<keyof typeof AdminAttributionGroupsGroupBy>('source')
const orderBy = ref<keyof typeof AdminAttributionGroupsOrderBy>('users')
const sortDir = ref<keyof typeof AdminAttributionGroupsSortDir>('desc')
const search = ref('')
const includeUnknown = ref(true)
const start = ref<string | null>(null)
const end = ref<string | null>(null)

const pagination = ref<TablePagination>({ sortBy: 'users', descending: true, page: 1, rowsPerPage: 25 })
const limit = computed(() => (pagination.value.rowsPerPage === 0 ? 1000 : pagination.value.rowsPerPage))
const offset = computed(() => (pagination.value.rowsPerPage === 0 ? 0 : (pagination.value.page - 1) * pagination.value.rowsPerPage))

const params = computed(() => ({
  groupBy: groupBy.value as any,
  orderBy: orderBy.value as any,
  sortDir: sortDir.value as any,
  search: search.value?.trim() ? search.value.trim() : undefined,
  includeUnknown: includeUnknown.value || undefined,
  startDateTime: start.value ? new Date(start.value).toISOString() : undefined,
  endDateTime: end.value ? new Date(end.value).toISOString() : undefined,
  limit: limit.value,
  offset: offset.value,
}))

const query = useAdminAttributionGroups(params)
const isLoading = query.isLoading
const isFetching = query.isFetching
const refetch = () => query.refetch()

const rows = computed(() => query.data?.value?.data?.items || [])
const total = computed(() => query.data?.value?.data?.total || rows.value.length)

watch([groupBy, orderBy, sortDir, search, includeUnknown, start, end], () => {
  pagination.value.page = 1
  refetch()
})

function onRequest({ pagination: p }: { pagination: TablePagination }) {
  pagination.value = p
  refetch()
}

type AttributionColumn = QTableColumn<any> & { help?: string }

const columns: AttributionColumn[] = [
  { name: 'key', label: 'Attribution Key', field: 'key', align: 'left', sortable: true, help: 'The grouped value for the selected dimension (source, UTM, referrer, or survey response).' },
  { name: 'users', label: 'Signups', field: 'users', align: 'right', sortable: true, format: (v: number) => (v || 0).toLocaleString(), help: 'Unique users whose first recorded attribution matched this key.' },
  { name: 'paidUsers', label: 'Paid Users', field: 'paidUsers', align: 'right', sortable: true, format: (v: number) => (v || 0).toLocaleString(), help: 'Users in this group who completed any payment.' },
  { name: 'createdImageUsers', label: 'Image Creators', field: 'createdImageUsers', align: 'right', sortable: true, format: (v: number) => (v || 0).toLocaleString(), help: 'Users in this group who have generated at least one image.' },
  { name: 'spentPointsTotal', label: 'Points Spent', field: 'spentPointsTotal', align: 'right', sortable: true, format: (v: number) => (v || 0).toLocaleString(), help: 'Total points spent across all users in this group.' },
  { name: 'usdTotal', label: 'USD Total', field: 'usdTotal', align: 'right', sortable: true, format: (v: number) => `$${(v || 0).toFixed(2)}`, help: 'All USD-equivalent revenue (PayPal + crypto + app stores) from this group.' },
  { name: 'usdPayPal', label: 'USD PayPal', field: 'usdPayPal', align: 'right', sortable: true, format: (v: number) => `$${(v || 0).toFixed(2)}`, help: 'Revenue collected via PayPal from users in this group.' },
  { name: 'usdCrypto', label: 'USD Crypto', field: 'usdCrypto', align: 'right', sortable: true, format: (v: number) => `$${(v || 0).toFixed(2)}`, help: 'Revenue collected via crypto payments from this group.' },
  { name: 'usdStars', label: 'USD Stars', field: 'usdStars', align: 'right', sortable: true, format: (v: number) => `$${(v || 0).toFixed(2)}`, help: 'Revenue collected via in-app stars for this group.' },
  { name: 'firstSignup', label: 'First Signup', field: 'firstSignup', sortable: true, help: 'Earliest signup date seen for this attribution key under the current filters.' },
  { name: 'lastSignup', label: 'Last Signup', field: 'lastSignup', sortable: true, help: 'Most recent signup date for this attribution key under the current filters.' },
]

const groupByDescriptions: Record<string, string> = {
  source: 'First-touch source captured from tracking pixels, referral links, or manual overrides.',
  utmSource: 'UTM source parameter recorded on the user’s first visit.',
  utmMedium: 'UTM medium parameter from the first recorded visit.',
  utmCampaign: 'UTM campaign parameter from the first recorded visit.',
  referrerDomain: 'Original referrer domain detected during signup.',
  landingDomain: 'First landing domain where the signup happened.',
  surveyResult: 'Answer chosen in the onboarding “How did you hear about Fiddl?” survey.',
  surveyResultOther: 'Free-form survey response entered when selecting “Other”.',
}

const groupBySummary = computed(() => groupByDescriptions[groupBy.value] || '')
const tableSummary = 'Metrics are aggregated per attribution key across the currently filtered signups. Counts are unique users.'

const groupByOptions = [
  { label: 'Source', value: 'source' },
  { label: 'UTM Source', value: 'utmSource' },
  { label: 'UTM Medium', value: 'utmMedium' },
  { label: 'UTM Campaign', value: 'utmCampaign' },
  { label: 'Referrer Domain', value: 'referrerDomain' },
  { label: 'Landing Domain', value: 'landingDomain' },
  { label: 'Survey Result', value: 'surveyResult' },
  { label: 'Survey Other', value: 'surveyResultOther' },
]

const orderByOptions = [
  { label: 'Key', value: 'key' },
  { label: 'Users', value: 'users' },
  { label: 'Paid Users', value: 'paidUsers' },
  { label: 'Spent Points', value: 'spentPointsTotal' },
  { label: 'Created Img Users', value: 'createdImageUsers' },
  { label: 'USD Total', value: 'usdTotal' },
  { label: 'USD PayPal', value: 'usdPayPal' },
  { label: 'USD Crypto', value: 'usdCrypto' },
  { label: 'USD Stars', value: 'usdStars' },
  { label: 'First Signup', value: 'firstSignup' },
  { label: 'Last Signup', value: 'lastSignup' },
]

const sortDirOptions = [
  { label: 'Desc', value: 'desc', icon: 'south' },
  { label: 'Asc', value: 'asc', icon: 'north' },
]
</script>
