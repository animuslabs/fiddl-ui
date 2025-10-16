import { defineStore } from "pinia"
import { Dialog, Notify, SessionStorage, Platform } from "quasar"
import {
  missionsList,
  missionsStatuses,
  missionsClaim,
  badgesList,
  badgesForUser,
  type MissionsList200Item,
  type MissionsList200ItemRewardsItem,
  type MissionsClaim200,
  type BadgesList200Item,
  type BadgesForUser200Item,
} from "lib/orval"
import { useUserAuth } from "stores/userAuth"
import { catchErr } from "lib/util"
import { events } from "lib/eventsManager"

export type RewardView =
  | { type: "points"; amount: number; memo?: string }
  | { type: "badge"; badgeId: string; badge?: BadgesList200Item }

export const useMissionsStore = defineStore("missionsStore", {
  state: () => ({
    loading: false as boolean,
    missions: [] as MissionsList200Item[],
    progressMap: {} as Record<string, number>,
    claiming: {} as Record<string, boolean>,
    claimedMap: {} as Record<string, boolean>,
    badgeMap: {} as Record<string, BadgesList200Item>,
    userBadgeIds: [] as string[],
    _poller: null as any,
    _visHandler: null as any,
  }),
  getters: {
    missionsEnriched(state): Array<MissionsList200Item & { progress: number; rewardsNormalized: RewardView[] }> {
      const normalize = (rewards: MissionsList200ItemRewardsItem[]): RewardView[] => {
        return (rewards || []).map((r: any) => {
          if (r?.type === "points") return { type: "points", amount: r.amount, memo: r.memo }
          if (r?.type === "badge") {
            const badge = state.badgeMap[r.badgeId]
            return { type: "badge", badgeId: r.badgeId, badge }
          }
          return { type: "points", amount: 0 }
        })
      }
      const list: MissionsList200Item[] = Array.isArray(state.missions) ? state.missions : []
      return list.map((m) => ({
        ...m,
        progress: state.progressMap[m.id] ?? 0,
        rewardsNormalized: normalize(m.rewards || []),
      }))
    },
    userBadgeIdsSet(state): Set<string> {
      return new Set(state.userBadgeIds)
    },
    claimableMissions(): Array<MissionsList200Item & { progress: number; rewardsNormalized: RewardView[] }> {
      return this.missionsEnriched.filter((m) => !this.claimedMap[m.id] && (m.progress || 0) >= 100)
    },
    inProgressMissions(): Array<MissionsList200Item & { progress: number; rewardsNormalized: RewardView[] }> {
      return this.missionsEnriched.filter((m) => !this.claimedMap[m.id] && (m.progress || 0) < 100)
    },
    // Active missions sorted by progress descending; 100% (claimable) naturally float to top.
    activeMissionsSorted(): Array<MissionsList200Item & { progress: number; rewardsNormalized: RewardView[] }> {
      return this.missionsEnriched
        .filter((m) => !this.claimedMap[m.id])
        .slice()
        .sort((a, b) => (b.progress || 0) - (a.progress || 0))
    },
    claimedMissions(): Array<MissionsList200Item & { progress: number; rewardsNormalized: RewardView[] }> {
      return this.missionsEnriched.filter((m) => this.claimedMap[m.id])
    },
    completedCount(): number {
      return this.missionsEnriched.filter((m) => (m.progress || 0) >= 100).length
    },
  },
  actions: {
    reset() {
      this.missions = []
      this.progressMap = {}
      this.claiming = {}
      this.claimedMap = {}
      this.badgeMap = {}
      this.userBadgeIds = []
    },
    async refreshAll() {
      const auth = useUserAuth()
      if (!auth.loggedIn) return
      this.loading = true
      try {
        const [missionsRes, badgesRes, myBadgesRes] = await Promise.all([missionsList(), badgesList(), badgesForUser()])
        this.missions = missionsRes.data || []
        const badgesArr = badgesRes.data || []
        const myBadgesArr = myBadgesRes.data || []
        const map: Record<string, BadgesList200Item> = {}
        for (const b of badgesArr) map[b.id] = b
        this.badgeMap = map
        this.userBadgeIds = myBadgesArr.map((ub: BadgesForUser200Item) => ub.badge.id)
        await this.loadProgressForAll()
      } catch (e) {
        // silent
      } finally {
        this.loading = false
      }
    },
    async loadProgressForAll() {
      try {
        const { data } = await missionsStatuses()
        const statuses = data?.statuses || []
        const byId: Record<string, any> = {}
        for (const st of statuses) byId[st.missionId] = st
        const missions = this.missions || []
        for (const m of missions) {
          const st = byId[m.id]
          if (st) {
            this.progressMap[m.id] = Math.max(0, Math.min(100, st.progress || 0))
            this.claimedMap[m.id] = !!st.claimed
          } else {
            this.progressMap[m.id] = 0
          }
        }
      } catch {}
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
          try {
            events.missionClaimed({
              missionId: mission.id,
              rewards: (res.rewardsAwarded || []).map((rw: any) => ({ type: rw.type, amount: rw.amount, badgeId: rw.badgeId })),
            })
          } catch {}
          // refresh owned badges
          try {
            const { data: myBadges } = await badgesForUser()
            this.userBadgeIds = (myBadges || []).map((ub: BadgesForUser200Item) => ub.badge.id)
          } catch {}
          // refresh user points balance after claim
          try {
            const auth = useUserAuth()
            await auth.loadUserData()
          } catch {}
        } else {
          msg = res.reason || "Not eligible to claim"
          if ((res.reason || "").toLowerCase().includes("already")) this.claimedMap[mission.id] = true
        }
        Notify.create({
          message: msg,
          color: (res as any).awarded ? "positive" : "warning",
          position: Platform.is.mobile ? "top" : void 0,
        })
      } catch (error) {
        // Surface detailed error via shared handler
        catchErr(error)
      } finally {
        this.claiming[mission.id] = false
      }
    },
    startPolling() {
      const auth = useUserAuth()
      if (!auth.loggedIn) return
      // Avoid multiple intervals
      if (this._poller) return
      // Initial load on login
      void this.refreshAll()
      const schedule = (ms: number) => {
        this._poller = setTimeout(run, ms)
      }
      const run = async () => {
        try {
          await this.loadProgressForAll()
        } finally {
          const hidden = typeof document !== "undefined" && document.hidden
          const delay = hidden ? 120_000 : 30_000
          schedule(delay)
        }
      }
      // Install a visibility listener to immediately reschedule when tab becomes visible
      if (typeof document !== "undefined" && !this._visHandler) {
        this._visHandler = () => {
          if (!document.hidden) {
            if (this._poller) {
              clearTimeout(this._poller)
              this._poller = null
            }
            if (typeof document !== "undefined" && this._visHandler) {
              document.removeEventListener("visibilitychange", this._visHandler)
              this._visHandler = null
            }
            schedule(1)
          }
        }
        document.addEventListener("visibilitychange", this._visHandler)
      }
      schedule(1)
    },
    stopPolling() {
      if (this._poller) {
        clearTimeout(this._poller)
        this._poller = null
      }
    },
  },
})
