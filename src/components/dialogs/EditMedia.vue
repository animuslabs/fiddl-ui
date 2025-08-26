<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" )
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);  ")
      .centered
        h4.text-capitalize Edit {{ type }}
      div(v-if="!userOwnsMedia && !mediaUnlocked")
        .centered
          h5.q-ma-md You have not unlocked this {{ type }}.
        p.q-mb-md.q-ml-lg Unlock this {{ type }} to access:
        ul.q-ma-md
          li.q-ma-sm Full resolution display on fiddl.art without a watermark.
          li.q-ma-sm Download the original source {{ type }} as well as a 4k upscale (images only), suitable for printing.
          li.q-ma-sm Access the original prompt and model details, including the seed, necessary for creating similar images.
        .centered.q-pt-md
          q-btn(color="accent" :label="`Unlock ${type}`" @click="unlock()" :disable="!$userAuth.loggedIn")
            .badge
              p {{prices[type].unlock}}
        .centered(v-if="!$userAuth.loggedIn").q-mt-lg
          q-btn(color="primary" @click="goToLogin()" label="Login to purchase media")
      div(v-else style="height:30vh")
        .centered
          p.q-ma-md You own this {{ type }}.
        .centered
          p How would you like use this creation?
        .centered
          div.q-pt-lg
            .row.q-mb-md
              q-btn.q-mr-md(:label="`Prompt`" @click="startEditing('prompt')" color="primary" icon="edit" outline stack)
              .col-grow
              q-btn(:label="`All`" @click="startEditing('all')" color="primary" icon="edit_note" outline stack)
            .centered(v-if="type=='image'")
              q-btn(:label="`Create Video`" @click="startEditing('video')" color="primary" icon="video_settings" stack size="lg")
              //- h4.q-ma-md Start Editing

      .centered.q-pt-md.q-pb-md
        q-btn(label="< back" color="grey" flat @click="hide()")

</template>

<script lang="ts">
import { catchErr, downloadFile, purchaseMedia } from "lib/util"
import { QDialog, Notify, Dialog, SessionStorage, Loading } from "quasar"
import { defineComponent, PropType } from "vue"
import { creationsOriginalImage, creationsUpscaledImage } from "src/lib/orval"
import { CreateEditType, MediaType } from "lib/types"
import { dialogProps } from "src/components/dialogs/dialogUtil"
import { prices } from "stores/pricesStore"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { markOwned, clearOwned } from "lib/ownedMediaCache"
import { match } from "ts-pattern"

export default defineComponent({
  props: dialogProps,
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
      const store = useMediaViewerStore()
      // Optimistically mark as owned instantly
      store.setOwnedOptimistic()
      this.mediaUnlocked = true
      markOwned(this.currentMediaId, this.type)
      try {
        await purchaseMedia(this.currentMediaId, this.type)
        store.triedHdLoad = false
        void store.loadHdMedia()
        // Do not close the dialog; user may choose an editing path
        this.$emit("unlocked")
      } catch (error) {
        // Revert optimistic state on failure
        clearOwned(this.currentMediaId, this.type)
        store.userOwnsMedia = false
        this.mediaUnlocked = false
        catchErr(error)
      }
    },
    startEditing(editType: CreateEditType) {
      void this.$router.push({ name: "create", query: { mediaId: this.currentMediaId, type: this.type, editType } })
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
