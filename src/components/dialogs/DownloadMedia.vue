<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" )
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);  ")
      .centered
        h4.text-capitalize Download {{type}}
      div(v-if="!userOwnsMedia && !mediaUnlocked")
        .centered
          h5.q-ma-md You have not unlocked this {{type}}.
        p.q-mb-md.q-ml-lg Unlock this {{type}} to access:
        ul.q-ma-md
          li.q-ma-sm Full resolution display on fiddl.art without a watermark.
          li.q-ma-sm Download the original art
          li.q-ma-sm For images: download a 4k upscale, suitable for printing.
          li.q-ma-sm Access the original prompt and model details, including the seed, necessary for creating similar creations.
        .centered.q-pt-md
          q-btn.text-capitalize(color="accent" :label="`Unlock ${type}`" @click="unlock()" :disable="!$userAuth.loggedIn")
            .badge
              p 10
        .centered(v-if="!$userAuth.loggedIn").q-mt-lg
          q-btn(color="primary" @click="goToLogin()" label="Login to purchase images")
      div(v-else style="height:30vh")
        .centered
          p.q-ma-md You own this {{ type }}.
        .centered
          div
            .row
              p.q-ma-md Downloads
            .col-auto
              q-btn(label="original" icon="image" @click="downloadOriginal()")
            .col-auto(v-if="type == 'image'")
              q-btn(label="4k Upscale" icon="4k" @click="downloadUpscaled()")
            small(v-if="type == 'image'") Upscaling can take 30+ seconds the first time
      .centered.q-pt-md.q-pb-md
        q-btn(label="< back" color="grey" flat @click="hide()")

</template>

<script lang="ts">
import { catchErr, downloadFile, purchaseMedia, triggerDownload } from "lib/util"
import { QDialog, Notify, Dialog, SessionStorage, Loading } from "quasar"
import { defineComponent, PropType } from "vue"
import { creationsOriginalImage, creationsUpscaledImage, creationsPurchaseMedia } from "src/lib/orval"
import { MediaType } from "lib/types"
import { originalFileKey } from "lib/netlifyImg"
import { creationsHdVideo } from "src/lib/orval"
import { sleep } from "lib/util"

export default defineComponent({
  props: {
    userOwnsMedia: Boolean,
    currentMediaId: {
      type: String as PropType<string | null>,
      default: null,
    },
    type: {
      type: String as PropType<MediaType>,
    },
  },

  emits: ["unlocked", "hide", "ok"],
  data() {
    return {
      mediaUnlocked: false,
    }
  },
  watch: {},

  methods: {
    async downloadOriginal() {
      if (!this.userOwnsMedia && !this.mediaUnlocked) return
      if (!this.currentMediaId) return
      try {
        Loading.show({
          message: "Downloading Image",
        })
        if (this.type == "image") {
          const response = await creationsOriginalImage({ imageId: this.currentMediaId }).catch(catchErr)
          const imageData = response?.data
          const imageDataUrl = `data:image/png;base64,${imageData}`
          downloadFile(imageDataUrl, this.currentMediaId + "-original.png")
        } else {
          const { data } = await creationsHdVideo({ download: true, videoId: this.currentMediaId })
          void triggerDownload(data)
          await sleep(3000)
        }
        Loading.hide()
        this.hide()
      } catch (error: any) {
        console.error(error)
        Loading.hide()
        Notify.create({
          message: "error downloading image",
          color: "negative",
        })
      }
    },
    async downloadUpscaled() {
      if (!this.userOwnsMedia && !this.mediaUnlocked) return
      if (!this.currentMediaId) return
      if (this.type == "video") catchErr("video upscaling not yet supported")
      Loading.show({
        message: "Upscaling Image",
      })
      const response = await creationsUpscaledImage({ imageId: this.currentMediaId }).catch(catchErr)
      const imageData = response?.data
      if (!imageData) {
        Loading.hide()
        return console.error("No image data")
      }
      const imageDataUrl = `data:image/png;base64,${imageData}`
      downloadFile(imageDataUrl, this.currentMediaId + "-upscaled.png")
      Loading.hide()
    },
    goToLogin() {
      void this.$router.push({ name: "login" })
      this.hide()
    },
    async unlock() {
      if (!this.currentMediaId) return
      await purchaseMedia(this.currentMediaId, this.type!)
      this.mediaUnlocked = true
      this.$emit("unlocked")
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
