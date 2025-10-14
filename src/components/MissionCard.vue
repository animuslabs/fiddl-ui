<template lang="pug">
q-card.mission-card
  // Top content
  q-card-section
    .row.items-start.justify-between.q-gutter-md
      .col-12.col-md
        .row
          h4.text-capitalize {{ title }}
        .text-subtitle1 {{ mission.description }}
        .row.items-center.q-gutter-sm.q-mt-xs
          p Reward:
          template(v-for="(rw, idx) in mission.rewardsNormalized" :key="idx")
            q-chip(size="25px" v-if="rw.type === 'points'" color="grey-9" text-color="white" dense icon="img:/FiddlPointsLogo.svg")
              p +{{ rw.amount }}
            .row.items-center.q-gutter-xs(v-else)
              q-avatar(size="24px")
                q-img(:src="rw.badge?.imageUrl" no-spinner :ratio="1")
              .text-caption {{ rw.badge?.name || 'Badge' }}
              q-badge(v-if="rw.badge && userBadgeIdsSet?.has(rw.badge.id)" color="green-10" text-color="white" class="q-ml-xs" label="Owned" dense)
          // Community completion info placed inline with rewards
          .row.items-center.q-gutter-xs(v-if="mission.activeUsersEarnedPct !== undefined")
            q-icon(name="groups" size="18px" color="grey-6")
              q-tooltip(anchor="top middle" self="bottom middle") Percent of active users who have claimed this mission
            .text-caption.text-grey-5 {{ Math.round(mission.activeUsersEarnedPct || 0) }}% claimed
      .col-12.col-md-auto
        q-btn(
          :color="claimed ? 'grey-8' : 'primary'"
          :label="claimed ? 'Claimed' : 'Claim'"
          rounded
          size="15px"
          icon="redeem"
          :disable="!canClaim || claimed || claiming"
          :loading="claiming"
          @click.stop="onClaim"
        )
  // Spacer pushes progress to the bottom in flexible height
  .mission-card__spacer
  q-separator
  // Bottom progress area
  q-card-section
    .row.items-center.q-gutter-sm
      q-linear-progress.full-width(:value="progressValue" :animation-speed="progressAnimMs" color="accent" track-color="grey-8" style="height:10px;")
      h4 {{ Math.floor(mission.progress || 0) }}%
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted, watch, onBeforeUnmount } from 'vue'

export default defineComponent({
  name: 'MissionCard',
  props: {
    mission: { type: Object, required: true },
    claimed: { type: Boolean, default: false },
    claiming: { type: Boolean, default: false },
    userBadgeIdsSet: { type: Object, default: null },
  },
  emits: ['claim'],
  setup(props, { emit }) {
    const title = computed(() => String(props.mission?.id || '').replace(/-/g, ' '))
    const canClaim = computed(() => (props.mission?.progress || 0) >= 100 && !props.claimed)

    // Target progress (0..1)
    const progressTarget = computed(() => Math.max(0, Math.min(1, (props.mission?.progress || 0) / 100)))

    // Animated value shown by the linear progress
    const progressValue = ref(0)

    // Random delay and animation speed for variety on load
    const progressDelayMs = Math.floor(Math.random() * 600) // 0-600ms
    const progressAnimMs = 900 + Math.floor(Math.random() * 1800) // 900-2700ms

    let delayTimer: ReturnType<typeof setTimeout> | null = null
    let raf1: number | null = null
    let raf2: number | null = null

    onMounted(() => {
      // Stage the animation to ensure initial 0 state
      progressValue.value = 0
      raf1 = requestAnimationFrame(() => {
        // Force a paint before starting transitions
        void document.body.offsetHeight
        raf2 = requestAnimationFrame(() => {
          delayTimer = setTimeout(() => {
            progressValue.value = progressTarget.value
          }, progressDelayMs)
        })
      })
    })

    // Keep synced on updates without extra delay
    watch(
      progressTarget,
      (val) => {
        progressValue.value = val
      },
      { flush: 'post' }
    )

    onBeforeUnmount(() => {
      if (delayTimer) clearTimeout(delayTimer)
      if (raf1 !== null) cancelAnimationFrame(raf1)
      if (raf2 !== null) cancelAnimationFrame(raf2)
    })

    const onClaim = () => {
      if (!canClaim.value) return
      emit('claim', props.mission)
    }
    return { title, canClaim, onClaim, progressValue, progressAnimMs }
  },
})
</script>

<style scoped>
.mission-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.mission-card__spacer {
  flex: 1 1 auto;
}
</style>
