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
      q-linear-progress.full-width(:value="progressValue" color="accent" track-color="grey-8" style="height:10px;")
      h4 {{ Math.floor(mission.progress || 0) }}%
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

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
    const progressValue = computed(() => Math.max(0, Math.min(1, (props.mission?.progress || 0) / 100)))
    const onClaim = () => {
      if (!canClaim.value) return
      emit('claim', props.mission)
    }
    return { title, canClaim, onClaim, progressValue }
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

