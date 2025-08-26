<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" )
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);  ")
      .centered
        //- h4 {{ requestId }}
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
              p {{ prices[type].unlock }}
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
            .col-auto(v-if="type == 'image' && !isSvg")
              q-btn(label="4k Upscale" icon="4k" @click="downloadUpscaled()" )
            small(v-if="type == 'image'") Upscaling can take 30+ seconds the first time
      .centered.q-pt-md.q-pb-md
        q-btn(label="< back" color="grey" flat @click="hide()")

</template>

<script lang="ts">
import { catchErr, downloadFile, longIdToShort, purchaseMedia, triggerDownload } from "lib/util"
import { QDialog, Notify, Dialog, SessionStorage, Loading } from "quasar"
import { defineComponent, PropType } from "vue"
import { creationsOriginalImage, creationsUpscaledImage, creationsPurchaseMedia, CreationsGetImageRequest200, creationsGetImageRequest } from "src/lib/orval"
import { MediaType } from "lib/types"
import { originalFileKey } from "lib/netlifyImg"
import { creationsHdVideo } from "src/lib/orval"
import { sleep } from "lib/util"
import { dialogProps } from "src/components/dialogs/dialogUtil"
import { prices } from "stores/pricesStore"
import { useMediaViewerStore } from "src/stores/mediaViewerStore"
import { markOwned, clearOwned } from "lib/ownedMediaCache"
export default defineComponent({
  props: { ...dialogProps, requestId: { type: String, required: false } },
  emits: ["unlocked", "hide", "ok"],
  data() {
    return {
      mediaUnlocked: false,
      requestData: null as null | CreationsGetImageRequest200,
      prices,
      isSvg: false,
    }
  },
  watch: {},
  async mounted() {
    if (!this.requestId) return
    const { data } = await creationsGetImageRequest({ imageRequestId: this.requestId })
    this.requestData = data
    if (data.model?.includes("svg")) this.isSvg = true
  },
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
          const imageDataUrl = this.isSvg ? `data:image/png;base64,${imageData}` : `data:image/png;base64,${imageData}`
          const extension = this.isSvg ? ".svg" : ".png"
          downloadFile(imageDataUrl, longIdToShort(this.currentMediaId) + "-original" + extension)
        } else {
          const { data } = await creationsHdVideo({ download: true, videoId: this.currentMediaId })
          void triggerDownload(data, `fiddl.art-${longIdToShort(this.currentMediaId)}-original.mp4`)
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
      if (!this.currentMediaId || this.isSvg) return
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
      const store = useMediaViewerStore()
      // Optimistically mark as owned instantly
      store.setOwnedOptimistic()
      this.mediaUnlocked = true
      markOwned(this.currentMediaId, this.type!)
      try {
        await purchaseMedia(this.currentMediaId, this.type!)
        store.triedHdLoad = false
        void store.loadHdMedia()
        // Keep dialog open to show downloads section and still notify listeners
        this.$emit("unlocked")
      } catch (e) {
        // Revert optimistic state on failure
        clearOwned(this.currentMediaId, this.type!)
        store.userOwnsMedia = false
        this.mediaUnlocked = false
        catchErr(e)
      }
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
