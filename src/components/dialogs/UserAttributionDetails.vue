<template lang="pug">
q-dialog(
  ref="dialogRef"
  :maximized="$q.screen.lt.md"
  transition-show="jump-down"
  transition-hide="jump-up"
  @hide="onDialogHide"
)
  q-card.q-dialog-plugin.attribution-dialog(:style="cardStyle")
    q-card-section(class="row items-center q-gutter-sm")
      q-avatar(icon="insights" color="primary" text-color="white")
      .column
        .text-h6 User Attribution Details
        .text-caption.text-grey-7 {{ subtitle }}
      q-space
      q-btn(flat round dense icon="close" @click="onDialogCancel")
    q-separator

    q-card-section(class="q-pt-none")
      q-scroll-area(:style="scrollAreaStyle" class="q-pr-sm")
        .column.q-gutter-lg
          div(v-for="section in sections" :key="section.key" class="section-block")
            .row.items-center.q-gutter-sm.q-mb-xs
              .text-subtitle2 {{ section.label }}
              q-spinner(size="xs" v-if="section.loading")
            template(v-if="section.error")
              q-banner(dense inline-actions class="bg-red-2 text-negative")
                template(#avatar)
                  q-icon(name="warning")
                | Failed to load
            template(v-else-if="section.items && section.items.length")
              q-markup-table(dense flat bordered class="attribution-table")
                thead
                  tr
                    th.label-col Value
                    th.count-col Users
                    th.count-col Paid
                    th.count-col Created Img
                tbody
                  tr(v-for="item in section.items" :key="`${section.key}-${String(item.key ?? 'unknown')}`")
                    td.label-col {{ formatValue(item.key) }}
                    td.count-col {{ formatCount(item.users) }}
                    td.count-col {{ formatCount(item.paidUsers) }}
                    td.count-col {{ formatCount(item.createdImageUsers) }}
            template(v-else)
              .text-grey-7 None

    q-separator
    q-card-actions(align="right")
      q-btn(flat label="Close" @click="onDialogCancel")
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { adminAttributionGroups, AdminAttributionGroupsOrderBy, AdminAttributionGroupsSortDir, type AdminAttributionGroups200ItemsItem } from 'src/lib/orval'

defineEmits([...useDialogPluginComponent.emits])

const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

const props = defineProps<{ userId: string; username?: string | null; searchHints?: string[] | null }>()

const subtitle = computed(() => (props.username ? `@${props.username} (${props.userId})` : props.userId))

type Section = { key: string; label: string; items: AdminAttributionGroups200ItemsItem[]; loading: boolean; error: boolean }

const sections = reactive<Section[]>([
  { key: 'source', label: 'Source', items: [], loading: true, error: false },
  { key: 'utmSource', label: 'UTM Source', items: [], loading: true, error: false },
  { key: 'utmMedium', label: 'UTM Medium', items: [], loading: true, error: false },
  { key: 'utmCampaign', label: 'UTM Campaign', items: [], loading: true, error: false },
  { key: 'referrerDomain', label: 'Referrer Domain', items: [], loading: true, error: false },
  { key: 'landingDomain', label: 'Landing Domain', items: [], loading: true, error: false },
  { key: 'surveyResult', label: 'Survey Result', items: [], loading: true, error: false },
  { key: 'surveyResultOther', label: 'Survey Other', items: [], loading: true, error: false },
])

const cardStyle = computed(() => {
  if ($q.screen.lt.md) {
    return {
      width: '100%',
      maxWidth: '100vw',
      maxHeight: 'calc(100vh - 48px)',
    }
  }
  return {
    width: '760px',
    maxWidth: '95vw',
    maxHeight: 'calc(100vh - 96px)',
  }
})

const scrollAreaStyle = computed(() => {
  if ($q.screen.lt.md) {
    return 'max-height: calc(100vh - 220px);'
  }
  return 'max-height: 60vh;'
})

const formatValue = (value: unknown) => {
  if (value == null) return 'Unknown'
  if (typeof value === 'string' && value.trim().length === 0) return 'Unknown'
  return String(value)
}

const formatCount = (value: number | null | undefined) => {
  const v = typeof value === 'number' ? value : Number(value || 0)
  return v.toLocaleString()
}

const searchTerms = computed(() => {
  const terms = new Set<string>()
  const push = (value?: string | null) => {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed) terms.add(trimmed)
  }
  push(props.userId)
  if (props.username) {
    const unprefixed = props.username.replace(/^@/, '')
    push(unprefixed)
    push(`@${unprefixed}`)
  }
  props.searchHints?.forEach((hint) => push(hint))
  return Array.from(terms)
})

async function loadSections() {
  const terms = searchTerms.value
  for (const section of sections) {
    section.loading = true
    section.error = false
    section.items = []

    if (terms.length === 0) {
      section.loading = false
      continue
    }

    let loaded = false
    let hadError = false

    for (const term of terms) {
      try {
        const { data } = await adminAttributionGroups({
          groupBy: section.key as any,
          search: term,
          includeUnknown: true,
          limit: 25,
          offset: 0,
          orderBy: AdminAttributionGroupsOrderBy.users,
          sortDir: AdminAttributionGroupsSortDir.desc,
        })
        const items = Array.isArray(data?.items) ? data.items : []
        if (items.length > 0) {
          section.items = items
          loaded = true
          break
        }
      } catch (e) {
        hadError = true
      }
    }

    if (!loaded && hadError) {
      section.error = true
    }
    section.loading = false
  }
}

onMounted(() => {
  void loadSections()
})

watch(searchTerms, () => {
  void loadSections()
})
</script>

<style scoped lang="scss">
.attribution-dialog {
  display: flex;
  flex-direction: column;
}

.section-block {
  min-width: 0;
}

.attribution-table thead tr th,
.attribution-table tbody tr td {
  white-space: nowrap;
}

.attribution-table .label-col {
  width: 45%;
}

.attribution-table .count-col {
  width: 18%;
  text-align: right;
}
</style>
