<template lang="pug">
q-dialog(v-model="proxyModel" :maximized="isMobile")
  q-card(:style="cardStyle" class="column no-wrap")
    q-card-section.z-top.bg-grey-10(style="position:sticky; top:0px;")
      .row.items-center.justify-between
        h4.q-mt-none.q-mb-none Pick a Magic Mirror Mode
        q-btn(flat dense round icon="close" @click="close")
    q-separator
    q-card-section
      .row.q-col-gutter-md.items-stretch
        .col-12.col-sm-6.flex
          q-card(flat bordered class="option-card cursor-pointer fit" @click="goBanana")
            q-card-section.option-body
              .row.items-center.justify-between
                .row.items-center.no-wrap
                  q-icon(name="flash_on" color="amber-5" size="28px").q-mr-sm
                  .text-h6.text-weight-medium Magic Mirror Fast
                .row.items-center.no-wrap
                  //- q-chip(color="positive" text-color="white" dense class="q-mr-xs") Recommended
                  q-chip(color="primary" text-color="white" dense outline) {{ bananaCost }} pts
              .text-body2.q-mt-xs.text-grey-5 Start in seconds. No training required.
              .text-body2.text-grey-5 Great for first-time users and quick results.
            .row.q-ml-sm
              q-chip(color="grey-8" text-color="white") Uses Nano Banana Model
            q-separator
            q-card-actions(align="right")
              q-btn(label="Use Fast" color="primary" size="lg" icon="flash_on" no-caps @click.stop="goBanana")

        .col-12.col-sm-6.flex
          q-card(flat bordered class="option-card cursor-pointer fit" @click="goFlux")
            q-card-section.option-body
              .row.items-center.justify-between
                .row.items-center.no-wrap
                  q-icon(name="auto_awesome" color="deep-purple-4" size="28px").q-mr-sm
                  .text-h6.text-weight-medium Magic Mirror Pro
                q-chip(color="secondary" text-color="white" dense outline) {{ fluxCost }} pts
              .text-body2.q-mt-xs.text-grey-5 Best quality and most creative control.
              .text-body2.text-grey-5 Uses a personalized model; takes longer to set up.
            .row.q-ml-sm
              q-chip(color="grey-8" text-color="white") Uses Custom Flux Model
            q-separator
            q-card-actions(align="right")
              q-btn(label="Use Pro" size="lg" icon="auto_awesome" color="secondary" no-caps @click.stop="goFlux")
</template>

<script lang="ts">
import { defineComponent, computed } from "vue"
import { useRouter } from "vue-router"
import { prices } from "src/stores/pricesStore"
import { magicMirrorFastTotalPoints, magicMirrorProTotalPoints } from "src/lib/magic/magicCosts"
import { useQuasar } from "quasar"

export default defineComponent({
  name: "MagicMirrorDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    autoNavigate: { type: Boolean, default: true },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const router = useRouter()
    const $q = useQuasar()
    const proxyModel = computed({
      get: () => props.modelValue,
      set: (v: boolean) => emit("update:modelValue", v),
    })
    const fluxCost = computed(() => magicMirrorProTotalPoints())
    const bananaCost = computed(() => magicMirrorFastTotalPoints())
    const isMobile = computed(() => $q.screen.lt.md)
    const cardStyle = computed(() =>
      isMobile.value
        ? {
            width: "100vw",
            maxWidth: "100vw",
            height: "100vh",
            maxHeight: "100vh",
            borderRadius: 0,
            overflow: "auto",
          }
        : { width: "720px", maxWidth: "95vw" },
    )
    function close() {
      emit("update:modelValue", false)
    }
    function goFlux() {
      emit("update:modelValue", false)
      if (props.autoNavigate) void router.push({ name: "magicMirror" })
    }
    function goBanana() {
      emit("update:modelValue", false)
      if (props.autoNavigate) void router.push({ name: "magicMirrorBanana" })
    }
    return { proxyModel, close, goFlux, goBanana, fluxCost, bananaCost, isMobile, cardStyle }
  },
})
</script>

<style scoped>
.option-card {
  transition:
    transform 80ms ease,
    box-shadow 80ms ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.option-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}
.option-body {
  flex: 1 1 auto;
}
</style>
