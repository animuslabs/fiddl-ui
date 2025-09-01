<template lang="pug">
q-page
  .q-mx-auto(style="max-width:1800px; width:100%")
    .centered
      h3 Missions
    //- // Header
    //- .row.items-center.justify-between.q-mb-md
    //-   .row.items-center.q-gutter-sm
    //-     h5.q-mr-sm Missions
    //-     q-badge(v-if="completedCount > 0" color="positive" :label="completedCount + ' completed'")
    //-   .row.items-center.q-gutter-sm
    //-     q-btn(flat icon="refresh" label="Refresh" @click="refresh" :loading="loading")

    // Logged out banner
    div(v-if="!$userAuth.loggedIn").q-mt-lg
      q-banner(dense class="bg-grey-10 text-white")
        .row.items-center.justify-between.full-width
          .text-body2 Please log in to view and claim mission rewards
          q-btn(flat color="primary" label="Login / Register" @click="$router.push({ name: 'login' })")

    // Missions list
    template(v-else)
      q-linear-progress(v-if="loading" indeterminate color="primary")
      q-tabs(v-model="tab" dense class="q-mt-md")
        q-tab(name="active" icon="flag" label="Active")
        q-tab(name="claimed" icon="check_circle" label="Claimed")
      q-separator
      q-tab-panels.bg-transparent(v-model="tab" animated)
        q-tab-panel(name="active")
          .missions-grid
            // Claimable first, then in-progress
            MissionCard(
              v-for="m in activeMissionsSorted"
              :key="m.id"
              :mission="m"
              :claimed="!!claimedMap[m.id]"
              :claiming="!!claiming[m.id]"
              :userBadgeIdsSet="userBadgeIdsSet"
              @claim="claim"
            )
            div(v-if="activeMissionsSorted.length === 0 && !loading").text-grey-6.q-pa-lg.text-center
              | No active missions
        q-tab-panel(name="claimed")
          .missions-grid.q-mt-md
            MissionCard(
              v-for="m in claimedMissions"
              :key="m.id"
              :mission="m"
              :claimed="true"
              :userBadgeIdsSet="userBadgeIdsSet"
            )
            div(v-if="claimedMissions.length === 0 && !loading").text-grey-6.q-pa-lg.text-center
              | No claimed missions yet
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useMissionsStore } from "stores/missionsStore"
import MissionCard from "components/MissionCard.vue"

export default defineComponent({
  name: "MissionsPage",
  components: { MissionCard },
  data() {
    return {
      tab: "active" as string,
    }
  },
  computed: {
    missionsStore() {
      return useMissionsStore()
    },
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return window.matchMedia("(max-width: 1023px)").matches
    },
    loading(): boolean {
      return this.missionsStore.loading
    },
    userBadgeIdsSet(): Set<string> {
      return this.missionsStore.userBadgeIdsSet
    },
    activeMissionsSorted(): any[] {
      return this.missionsStore.activeMissionsSorted
    },
    claimedMissions(): any[] {
      return this.missionsStore.claimedMissions
    },
    claiming(): Record<string, boolean> {
      return this.missionsStore.claiming
    },
    claimedMap(): Record<string, boolean> {
      return this.missionsStore.claimedMap
    },
    progressMap(): Record<string, number> {
      return this.missionsStore.progressMap
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val: boolean) {
        if (val) void this.refresh()
        else this.missionsStore.reset()
      },
    },
  },
  methods: {
    async refresh() {
      await this.missionsStore.refreshAll()
    },
    async claim(mission: any) {
      await this.missionsStore.claim(mission)
    },
  },
})
</script>

<style scoped>
.missions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}
@media (max-width: 1023px) {
  .missions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
