<template lang="pug">
q-page.q-pa-md
  .q-mx-auto(style="max-width:1200px; width:100%")
    // Header
    .row.items-center.justify-between.q-mb-md
      .row.items-center.q-gutter-sm
        h5.q-mr-sm Missions
        q-badge(v-if="completedCount > 0" color="positive" :label="completedCount + ' completed'")
      .row.items-center.q-gutter-sm
        q-btn(flat icon="refresh" label="Refresh" @click="refresh" :loading="loading")

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
      q-tab-panels(v-model="tab" animated)
        q-tab-panel(name="active")
          .column.q-gutter-md.q-mt-md
            // Claimable first, then in-progress
            q-card(v-for="m in activeMissionsSorted" :key="m.id")
              q-card-section
                .row.items-start.justify-between.q-gutter-md(:class="isMobile ? 'column' : 'row'")
                  .col
                    .text-subtitle1 {{ m.description }}
                    .row.items-center.q-gutter-sm.q-mt-xs
                      template(v-for="(rw, idx) in m.rewardsNormalized" :key="idx")
                        q-chip(v-if="rw.type === 'points'" color="blue-10" text-color="white" dense icon="stars")
                          | {{ rw.amount }} points
                        .row.items-center.q-gutter-xs(v-else)
                          q-avatar(size="24px")
                            q-img(:src="rw.badge?.imageUrl" no-spinner :ratio="1")
                          .text-caption {{ rw.badge?.name || 'Badge' }}
                          q-badge(v-if="rw.badge && userBadgeIdsSet.has(rw.badge.id)" color="green-10" text-color="white" class="q-ml-xs" label="Owned" dense)
                  .col-auto
                    q-btn(
                      color="primary"
                      label="Claim"
                      :disable="(m.progress || 0) < 100 || claiming[m.id] || claimedMap[m.id]"
                      :loading="claiming[m.id]"
                      @click="claim(m)"
                    )

              q-separator
              q-card-section
                .row.items-center.q-gutter-sm
                  q-linear-progress(:value="(m.progress || 0) / 100" color="accent" track-color="grey-8" style="width: 240px")
                  .text-caption.text-grey-6 {{ Math.floor(m.progress || 0) }}%
            div(v-if="activeMissionsSorted.length === 0 && !loading").text-grey-6.q-pa-lg.text-center
              | No active missions
        q-tab-panel(name="claimed")
          .column.q-gutter-md.q-mt-md
            q-card(v-for="m in claimedMissions" :key="m.id")
              q-card-section
                .row.items-start.justify-between.q-gutter-md(:class="isMobile ? 'column' : 'row'")
                  .col
                    .text-subtitle1 {{ m.description }}
                    .row.items-center.q-gutter-sm.q-mt-xs
                      template(v-for="(rw, idx) in m.rewardsNormalized" :key="idx")
                        q-chip(v-if="rw.type === 'points'" color="blue-10" text-color="white" dense icon="stars")
                          | {{ rw.amount }} points
                        .row.items-center.q-gutter-xs(v-else)
                          q-avatar(size="24px")
                            q-img(:src="rw.badge?.imageUrl" no-spinner :ratio="1")
                          .text-caption {{ rw.badge?.name || 'Badge' }}
                          q-badge(v-if="rw.badge && userBadgeIdsSet.has(rw.badge.id)" color="green-10" text-color="white" class="q-ml-xs" label="Owned" dense)
              q-separator
              q-card-section
                .row.items-center.q-gutter-sm
                  q-linear-progress(:value="(m.progress || 0) / 100" color="accent" track-color="grey-8" style="width: 240px")
                  .text-caption.text-grey-6 {{ Math.floor(m.progress || 0) }}%
            div(v-if="claimedMissions.length === 0 && !loading").text-grey-6.q-pa-lg.text-center
              | No claimed missions yet
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { Notify } from "quasar"
import {
  missionsList,
  missionsStatus,
  missionsClaim,
  badgesList,
  badgesForUser,
  type MissionsList200Item,
  type MissionsList200ItemRewardsItem,
  type MissionsStatus200,
  type MissionsClaim200,
  type BadgesList200Item,
  type BadgesForUser200Item,
} from "../lib/orval"

type RewardView =
  | { type: "points"; amount: number; memo?: string }
  | { type: "badge"; badgeId: string; badge?: BadgesList200Item }

export default defineComponent({
  name: "MissionsPage",
  data() {
    return {
      tab: "active" as string,
      loading: false as boolean,
      missions: [] as MissionsList200Item[],
      progressMap: {} as Record<string, number>,
      claiming: {} as Record<string, boolean>,
      claimedMap: {} as Record<string, boolean>,
      badgeMap: {} as Record<string, BadgesList200Item>,
      userBadgeIds: [] as string[],
    }
  },
  computed: {
    isMobile(): boolean {
      if (typeof window === "undefined") return false
      return window.matchMedia("(max-width: 1023px)").matches
    },
    missionsEnriched(): Array<MissionsList200Item & { progress: number; rewardsNormalized: RewardView[] }> {
      const normalize = (rewards: MissionsList200ItemRewardsItem[]): RewardView[] => {
        return rewards.map((r: any) => {
          if (r.type === "points") return { type: "points", amount: r.amount, memo: r.memo }
          if (r.type === "badge") {
            const badge = this.badgeMap[r.badgeId]
            return { type: "badge", badgeId: r.badgeId, badge }
          }
          return { type: "points", amount: 0 }
        })
      }
      return this.missions.map((m) => ({
        ...m,
        progress: this.progressMap[m.id] ?? 0,
        rewardsNormalized: normalize(m.rewards || []),
      }))
    },
    completedCount(): number {
      return this.missionsEnriched.filter((m) => (m.progress || 0) >= 100).length
    },
    userBadgeIdsSet(): Set<string> {
      return new Set(this.userBadgeIds)
    },
    claimableMissions(): any[] {
      return this.missionsEnriched.filter((m) => !this.claimedMap[m.id] && (m.progress || 0) >= 100)
    },
    inProgressMissions(): any[] {
      return this.missionsEnriched.filter((m) => !this.claimedMap[m.id] && (m.progress || 0) < 100)
    },
    activeMissionsSorted(): any[] {
      return [...this.claimableMissions, ...this.inProgressMissions]
    },
    claimedMissions(): any[] {
      return this.missionsEnriched.filter((m) => this.claimedMap[m.id])
    },
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val: boolean) {
        if (val) void this.refresh()
        else {
          this.missions = []
          this.progressMap = {}
          this.claiming = {}
          this.claimedMap = {}
          this.userBadgeIds = []
        }
      },
    },
  },
  methods: {
    async refresh() {
      if (!this.$userAuth.loggedIn) return
      this.loading = true
      try {
        const [missionsRes, badgesRes, myBadgesRes] = await Promise.all([
          missionsList(),
          badgesList(),
          badgesForUser(),
        ])
        this.missions = missionsRes.data || []
        const badgesArr = badgesRes.data || []
        const myBadgesArr = myBadgesRes.data || []
        const map: Record<string, BadgesList200Item> = {}
        for (const b of badgesArr) map[b.id] = b
        this.badgeMap = map
        this.userBadgeIds = myBadgesArr.map((ub: BadgesForUser200Item) => ub.badge.id)

        await this.loadProgressForAll()
      } catch (e) {
        // ignore
      } finally {
        this.loading = false
      }
    },
    async loadProgressForAll() {
      const missions = this.missions || []
      const chunks: MissionsList200Item[][] = []
      const size = 8
      for (let i = 0; i < missions.length; i += size) chunks.push(missions.slice(i, i + size))
      for (const group of chunks) {
        await Promise.all(
          group.map(async (m) => {
            try {
              const { data } = await missionsStatus({ missionId: m.id })
              const st = data as MissionsStatus200
              this.progressMap[m.id] = Math.max(0, Math.min(100, st.progress || 0))
              this.claimedMap[m.id] = !!st.claimed
            } catch {
              this.progressMap[m.id] = 0
            }
          }),
        )
      }
    },
    async claim(mission: MissionsList200Item) {
      if ((this.progressMap[mission.id] || 0) < 100) return
      this.claiming[mission.id] = true
      try {
        const { data } = await missionsClaim({ missionId: mission.id })
        const res = data as MissionsClaim200
        this.progressMap[mission.id] = res.progress ?? this.progressMap[mission.id] ?? 100

        let msg = ""
        if (res.awarded) {
          const parts: string[] = []
          for (const r of res.rewardsAwarded || []) {
            if ((r as any).type === "points") parts.push(`${(r as any).amount} points`)
            if ((r as any).type === "badge") {
              const bId = (r as any).badgeId
              const badge = this.badgeMap[bId]
              parts.push(`badge${badge?.name ? `: ${badge.name}` : ""}`)
            }
          }
          msg = `Reward claimed${parts.length ? ": " + parts.join(", ") : ""}`
          this.claimedMap[mission.id] = true
          // refresh owned badges
          try {
            const { data: myBadges } = await badgesForUser()
            this.userBadgeIds = (myBadges || []).map((ub: BadgesForUser200Item) => ub.badge.id)
          } catch {}
          // refresh user points balance after claim
          try {
            await this.$userAuth.loadUserData()
          } catch {}
        } else {
          msg = res.reason || "Not eligible to claim"
          if ((res.reason || "").toLowerCase().includes("already")) this.claimedMap[mission.id] = true
        }
        Notify.create({ message: msg, color: res.awarded ? "positive" : "warning" })
      } catch {
        Notify.create({ message: "Failed to claim reward", color: "negative" })
      } finally {
        this.claiming[mission.id] = false
      }
    },
  },
})
</script>