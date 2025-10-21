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
import { computed, onMounted, reactive } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { adminAttributionGroups, type AdminAttributionGroups200ItemsItem } from 'src/lib/orval'

defineEmits([...useDialogPluginComponent.emits])

const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

const props = defineProps<{ userId: string; username?: string | null }>()

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

onMounted(async () => {
  // Fetch per section serially to avoid hammering the API
  for (const s of sections) {
    s.loading = true
    s.error = false
    try {
      const { data } = await adminAttributionGroups({
        groupBy: s.key as any,
        // NOTE: The API groups globally; user-level search may not match userId exactly.
        search: props.userId,
        includeUnknown: true,
        limit: 10,
        offset: 0,
      })
      s.items = Array.isArray(data?.items) ? data.items : []
    } catch (e) {
      s.error = true
      s.items = []
    } finally {
      s.loading = false
    }
  }
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
