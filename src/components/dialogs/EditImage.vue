<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" )
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);  ")
      .centered
        h4 Edit Image
      div(v-if="!userOwnsImage && !imageUnlocked")
        .centered
          h5.q-ma-md You have not unlocked this image.
        p.q-mb-md.q-ml-lg Unlock this image to access:
        ul.q-ma-md
          li.q-ma-sm Full resolution display on fiddl.art without a watermark.
          li.q-ma-sm Download the original source image as well as a 4k upscale, suitable for printing.
          li.q-ma-sm Access the original prompt and model details, including the seed, necessary for creating similar images.
        .centered.q-pt-md
          q-btn(color="accent" label="Unlock Image" @click="unlock()" :disable="!$userAuth.loggedIn")
            .badge
              p 10
        .centered(v-if="!$userAuth.loggedIn").q-mt-lg
          q-btn(color="primary" @click="goToLogin()" label="Login to purchase images")
      div(v-else style="height:30vh")
        .centered
          p.q-ma-md You own this image.
        .centered
          div.q-pt-lg
            .row
              q-btn(label="Edit Image" @click="startEditing()" color="accent" icon="edit")
              //- h4.q-ma-md Start Editing

      .centered.q-pt-md.q-pb-md
        q-btn(label="< back" color="grey" flat @click="hide()")

</template>

<script lang="ts">
import { catchErr, downloadFile } from "lib/util"
import { QDialog, Notify, Dialog, SessionStorage, Loading } from "quasar"
import { PropType } from "vue"

export default {
  props: {
    userOwnsImage: Boolean,
    currentImageId: {
      type: String as PropType<string | null>,
      default: null,
    },
  },

  emits: ["unlocked", "hide", "ok"],
  data() {
    return {
      imageUnlocked: false,
    }
  },
  watch: {},

  methods: {
    async downloadOriginal() {
      if (!this.userOwnsImage && !this.imageUnlocked) return
      if (!this.currentImageId) return
      const imageData = (await this.$api.creations.originalImage.query(this.currentImageId).catch(catchErr)) || undefined
      const imageDataUrl = `data:image/png;base64,${imageData}`
      downloadFile(imageDataUrl, this.currentImageId + "-original.png")
    },
    async downloadUpscaled() {
      if (!this.userOwnsImage && !this.imageUnlocked) return
      if (!this.currentImageId) return
      Loading.show({
        message: "Upscaling Image",
      })
      const imageData = (await this.$api.creations.upscaledImage.query(this.currentImageId).catch(catchErr)) || undefined
      if (!imageData) return console.error("No image data")
      const imageDataUrl = `data:image/png;base64,${imageData}`
      downloadFile(imageDataUrl, this.currentImageId + "-upscaled.png")
      Loading.hide()
    },
    goToLogin() {
      void this.$router.push({ name: "login" })
      this.hide()
    },
    async unlock() {
      if (!this.currentImageId) return
      const result = await this.$api.creations.purchaseImage.mutate(this.currentImageId).catch(catchErr)
      if (!result) return
      try {
        SessionStorage.removeItem("noHdImage-" + this.currentImageId)
      } catch (err: any) {
        catchErr(err)
      }
      this.imageUnlocked = true
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
}
</script>
