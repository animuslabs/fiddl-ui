<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" )
  q-card.q-dialog-plugin(style="width:500px; max-width:90vw;")
    div.q-pt-md(style="background-color: rgba(0,0,0,.5);  ")
      .centered
        h4 Set Account Avatar
      div(v-if="!userOwnsMedia && !imageUnlocked")
        .centered
          h5.q-ma-md You have not unlocked this image.
        p.q-mb-md.q-ml-lg Unlock this image to access:
        ul.q-ma-md
          li.q-ma-sm Use the image as your avatar on your profile.
          li.q-ma-sm Full resolution display on fiddl.art without a watermark.
          li.q-ma-sm Download the original source image as well as a 4k upscale, suitable for printing.
          li.q-ma-sm Access the original prompt and model details, including the seed, necessary for creating similar images.
        .centered.q-pt-md.q-pb-lg
          q-btn(color="accent" label="Unlock Image" @click="unlock()" :disable="!$userAuth.loggedIn")
            .badge
              p 10
        .centered(v-if="!$userAuth.loggedIn").q-mt-lg
          q-btn(color="primary" @click="goToLogin()" label="Login to purchase images")
      div(v-else)
        //- .centered
        //-   p.q-ma-md You own this image.
        .centered.q-mt-lg.q-pb-lg
          ImageCropper(v-if="currentMediaId" :imageId="currentMediaId" @cropAccepted="setAvatar" @cancel="hide")
      //- .centered.q-pt-md.q-pb-md
      //-   q-btn(label="< back" color="grey" flat @click="hide()")

</template>

<script lang="ts">
import ImageCropper, { CropData } from "components/ImageCropper.vue"
import { img } from "lib/netlifyImg"
import reloadAvatar from "lib/reloadAvatar"
import { catchErr, purchaseMedia } from "lib/util"
import { Loading, Notify, QDialog, SessionStorage } from "quasar"
import { dialogProps } from "src/components/dialogs/dialogUtil"
import { creationsPurchaseMedia, userSetAvatar } from "src/lib/orval"
import { PropType } from "vue"
export default {
  components: {
    ImageCropper,
  },
  props: dialogProps,

  emits: ["unlocked", "hide", "ok"],
  data() {
    return {
      imageUnlocked: false,
      imageSrc: "",
    }
  },
  watch: {},
  mounted() {
    if (this.currentMediaId) {
      this.imageSrc = img(this.currentMediaId, "lg")
    }
  },

  methods: {
    async setAvatar(cropData: CropData) {
      console.log("setAvatar", cropData)
      if (!this.currentMediaId) return
      const { position, scale } = cropData
      Loading.show({ message: "Updating avatar" })
      try {
        await userSetAvatar({ imageId: this.currentMediaId, position, scale })
        reloadAvatar.value = Date.now()
        this.$root?.$forceUpdate()
        Notify.create({
          message: "Avatar updated",
          color: "positive",
        })
        Loading.hide()
        this.hide()
        window.location.reload()
      } catch (err) {
        Loading.hide()
        catchErr(err)
      }
    },
    goToLogin() {
      void this.$router.push({ name: "login" })
      this.hide()
    },
    async unlock() {
      if (!this.currentMediaId) return
      await purchaseMedia(this.currentMediaId, "image")
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
}
</script>
