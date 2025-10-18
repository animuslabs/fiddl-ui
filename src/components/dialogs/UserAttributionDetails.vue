<template lang="pug">
q-card.q-dialog-plugin(:style="$q.screen.lt.md ? 'width:92vw; max-width:92vw; max-height:90vh;' : 'width:760px; max-width:95vw; max-height:90vh;'")
  q-card-section(class="row items-center q-gutter-sm")
    q-avatar(icon="insights" color="primary" text-color="white")
    .column
      .text-h6 User Attribution Details
      .text-caption.text-grey-7 {{ subtitle }}
    q-space
    q-btn(flat round dense icon="close" v-close-popup)
  q-separator

  q-card-section
    q-scroll-area(style="height: calc(90vh - 120px)")
      .column.q-gutter-md
        div(v-for="section in sections" :key="section.key")
          .row.items-center.q-gutter-sm
            .text-subtitle2 {{ section.label }}
            q-spinner(size="xs" v-if="section.loading")
          .q-mt-xs
            template(v-if="section.error")
              q-banner(dense inline-actions class="bg-red-2 text-negative")
                template(#avatar)
                  q-icon(name="warning")
                | Failed to load
            template(v-else-if="section.items && section.items.length")
              .row.q-col-gutter-sm
                .col-12(v-for="item in section.items" :key="String(item.key) + '-' + section.key")
                  .row.items-center.q-gutter-xs
                    q-chip(size="sm" color="dark" text-color="white" dense)
                      | {{ item.key || 'Unknown' }}
                    q-chip(size="sm" color="primary" text-color="white" dense)
                      | Users: {{ (item.users || 0).toLocaleString() }}
                    q-chip(size="sm" color="secondary" text-color="white" dense)
                      | Paid: {{ (item.paidUsers || 0).toLocaleString() }}
                    q-chip(size="sm" color="grey-7" text-color="white" dense)
                      | Created Img: {{ (item.createdImageUsers || 0).toLocaleString() }}
            template(v-else)
              .text-grey-7 None

  q-separator
  q-card-actions(align="right")
    q-btn(flat label="Close" v-close-popup)
</template>

<script lang="ts" setup>
import { onMounted, reactive, computed } from 'vue'
import { adminAttributionGroups, type AdminAttributionGroups200ItemsItem } from 'src/lib/orval'

const props = defineProps<{ userId: string; username?: string | null }>()

const subtitle = computed(() => props.username ? `@${props.username} (${props.userId})` : props.userId)

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

onMounted(async () => {
  // Fetch per section serially to avoid overloading
  for (const s of sections) {
    s.loading = true
    s.error = false
    try {
      const { data } = await adminAttributionGroups({
        groupBy: s.key as any,
        // NOTE: The API groups globally; user-level search may not match.
        // We best-effort search by userId; if your API supports it, it will return matches.
        // Otherwise sections will be empty and UI shows "None".
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
