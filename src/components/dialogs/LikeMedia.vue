<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" )
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);  ")
      .centered
        h4.text-capitalize Like {{ type }}
      div(v-if="!userOwnsMedia && !mediaUnlocked")
        .centered
          h5.q-ma-md You have not unlocked this {{ type }}.
        p.q-mb-md.q-ml-lg Unlock this {{ type }} to access:
        ul.q-ma-md
          li.q-ma-sm Like, and add the {{ type }} to custom collections on your profile.
          li.q-ma-sm Full resolution display on fiddl.art without a watermark.
          li.q-ma-sm Download the original source {{ type }} as well as a 4k upscale (images only), suitable for printing.
          li.q-ma-sm Access the original prompt and model details, including the seed, necessary for creating similar {{ type }}.
        .centered.q-pt-md
          q-btn(color="accent" :label="`Unlock ${type}`" @click="unlock()" :disable="!$userAuth.loggedIn")
            .badge
              p {{prices[type].unlock}}
        .centered(v-if="!$userAuth.loggedIn").q-mt-lg
          q-btn(color="primary" @click="goToLogin()" label="Login to purchase images")
      .centered.q-pt-md.q-pb-md
        q-btn(label="< back" color="grey" flat @click="hide()")

</template>

<script lang="ts">
import { MediaType } from "lib/types"
import { purchaseMedia } from "lib/util"
import { QDialog } from "quasar"
import { defineComponent, PropType } from "vue"
import { prices } from "stores/pricesStore"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"

export default defineComponent({
  props: {
    type: {
      type: String as PropType<MediaType>,
      required: true,
    },
    userOwnsMedia: Boolean,
    currentMediaId: {
      type: String as PropType<string>,
      required: true,
    },
  },

  emits: ["unlocked", "hide", "ok"],
  data() {
    return {
      prices,
      mediaUnlocked: false,
    }
  },
  watch: {},

  methods: {
    goToLogin() {
      void this.$router.push({ name: "login" })
      this.hide()
    },
    async unlock() {
      await purchaseMedia(this.currentMediaId, this.type)
      this.mediaUnlocked = true
      // Optimistically mark as owned immediately
      const store = useMediaViewerStore()
      store.userOwnsMedia = true
      store.triedHdLoad = false
      void store.loadHdMedia()
      // Close like dialog after unlock as before
      this.onOKClick()
    },
    startEditing() {
      this.onOKClick()
    },
    show() {
      const dialog = this.$refs.dialog as QDialog
      dialog.show()
    },
    hide() {
      const dialog = this.$refs.dialog as QDialog
      dialog.hide()
    },

    onDialogHide() {
      this.$emit("hide")
    },

    onOKClick() {
      this.$emit("ok")

      this.hide()
    },

    onCancelClick() {
      this.hide()
    },
  },
})
</script>
