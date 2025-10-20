<template lang="pug">
transition(name="motd-banner-fade")
  q-banner.motd-banner.bg-primary.text-white(
    v-if="isVisible"
    rounded
    inline-actions
    dense
  )
    template(#avatar)
      q-icon(name="campaign" color="white" size="28px")
    .column.no-wrap.q-gutter-xs.cursor-pointer(@click="openDialog" style="min-width:0")
      .text-subtitle2.text-weight-medium {{ message?.title || 'Message of the Day' }}
      .text-body2(v-if="message?.subheading") {{ message.subheading }}
      .text-caption.text-grey-3(v-if="message?.startsAt") {{ formattedDate }}
    template(#action)
      q-btn(flat dense color="white" label="View" icon="open_in_new" @click.stop="openDialog")
</template>

<script lang="ts" setup>
import { computed } from "vue"
import { useMotdStore } from "stores/motdStore"

const store = useMotdStore()

const message = computed(() => store.latest)

const isVisible = computed(() => store.bannerVisible && Boolean(store.latest))

const formattedDate = computed(() => {
  if (!message.value?.startsAt) return ""
  try {
    return new Date(message.value.startsAt).toLocaleString()
  } catch {
    return ""
  }
})

function openDialog() {
  store.showDialog()
}
</script>

<style lang="sass" scoped>
.motd-banner
  width: 100%
  box-sizing: border-box
  border: 1px solid rgba(255,255,255,0.12)
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.85), rgba(25, 118, 210, 0.65))
  backdrop-filter: blur(6px)
  transition: opacity 0.2s ease, transform 0.2s ease
  .q-btn
    text-transform: none

.motd-banner-fade-enter-active,
.motd-banner-fade-leave-active
  transition: opacity 0.2s ease, transform 0.2s ease

.motd-banner-fade-enter-from,
.motd-banner-fade-leave-to
  opacity: 0
  transform: translateY(-6px)
</style>
