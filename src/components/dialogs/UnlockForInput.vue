<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide")
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);")
      .centered
        h4.text-capitalize Use this {{ type }} for editing
      div(v-if="!$userAuth.loggedIn")
        .centered
          h6.q-ma-md You need to login to unlock and edit {{ type }}s.
        .centered.q-pt-sm
          q-btn(color="primary" label="Login" @click="goToLogin()")
      div(v-else)
        .centered
          h5.q-ma-md To edit this {{ type }}, please unlock it first.
        p.q-mb-md.q-ml-lg Unlocking gives you:
        ul.q-ma-md
          li.q-ma-sm Use this {{ type }} as an input image for new creations.
          li.q-ma-sm Full resolution display on fiddl.art without a watermark.
          li.q-ma-sm Download the original source {{ type }} as well as a 4k upscale (images only), suitable for printing.
          li.q-ma-sm Access the original prompt and model details, including the seed, to recreate similar results.
        .centered.q-pt-md
          q-btn(color="accent" :label="`Unlock ${type}`" @click="unlock()" :disable="!$userAuth.loggedIn")
            .badge
              p {{ prices[type].unlock }}
    .centered.q-pt-md.q-pb-md
      q-btn(label="< back" color="grey" flat @click="hide()")
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { QDialog, Loading } from "quasar"
import { prices } from "stores/pricesStore"
import type { MediaType } from "lib/types"
import { purchaseMedia, catchErr } from "lib/util"
import { markOwned, clearOwned } from "lib/ownedMediaCache"

export default defineComponent({
  props: {
    type: { type: String as PropType<MediaType>, required: true },
    currentMediaId: { type: String as PropType<string>, required: true },
  },
  emits: ["unlocked", "hide", "ok"],
  data() {
    return { prices }
  },
  methods: {
    goToLogin() {
      void this.$router.push({ name: "login" })
      this.hide()
    },
    async unlock() {
      Loading.show()
      try {
        markOwned(this.currentMediaId, this.type)
        await purchaseMedia(this.currentMediaId, this.type)
        this.onOKClick()
      } catch (err) {
        clearOwned(this.currentMediaId, this.type)
        catchErr(err)
      } finally {
        Loading.hide()
      }
    },
    show() {
      ;(this.$refs.dialog as QDialog).show()
    },
    hide() {
      ;(this.$refs.dialog as QDialog).hide()
    },
    onDialogHide() {
      this.$emit("hide")
    },
    onOKClick() {
      this.$emit("ok")
      this.hide()
    },
  },
})
</script>

<style scoped>
.centered { display:flex; align-items:center; justify-content:center; }
</style>

