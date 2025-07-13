<template lang="pug">
q-card(style="overflow:auto;").q-mb-md.q-pr-md.q-pl-md.q-pb-lg
  //- div custom model id: {{ creation.customModelId }}
  //- div custom model name: {{ creation.customModelName }}
  .centered.full-width.q-pt-md(:style="quasar.screen.lt.md? `overflow:auto;`:'' ")
    div(v-if="creation.mediaIds.length < 1").full-width
      .centered.q-ma-xl
        h4.text-accent No images in this creation
    .col( v-for="(imageId,index) in creation.mediaIds" :key="imageId" style="max-width:300px; min-width:200px;").gt-sm.q-pa-sm
      CreatedImageCard.cursor-pointer( :imageId="imageId" @click="showGallery(index)" )
    .col( v-for="(imageId,index) in creation.mediaIds" :key="imageId" style="max-width:50vw; max-width:300px; min-width:100px; ").lt-md.q-pa-sm
      CreatedImageCard.cursor-pointer( :imageId="imageId" @click="showGallery(index)" style="max-width:30vw;" )
  div(v-if="!minimized.value")
    q-separator(color="grey-9" spaced="20px")
    .row.q-gutter-md(style="padding-left:20px; padding-right:20px;")
      .col-grow(style="min-width:150px;")
        .row(style="max-width:600px;")
          .col-auto
            .row
              q-btn(icon="edit" flat round @click="setRequest()" size="sm")
                q-tooltip
                  p Create using the creation details
            .row
              q-btn(icon="link" flat round @click="goToRequestPage()" size="sm" v-if="!hideLinkBtn")
                q-tooltip
                  p Go to creation
            .row
              q-btn(icon="delete" flat round @click="deleteRequest()" size="sm" v-if="creation.creatorId == $userAuth.userId")
                q-tooltip
                  p Delete
          .col.q-ml-md.relative-position
            small Prompt: #[p.ellipsis-3-lines {{ creation.prompt }}]
            p.text-italic.text-positive(v-if="!creation.prompt || creation.prompt?.length == 0 ") Purchase any image to unlock the prompt
            .absolute-bottom-right
              q-btn(icon="content_copy" round size="sm" color="grey-10" @click="copyPrompt" v-if="creation.prompt?.length").text-grey-6
                q-tooltip
                  p Copy Prompt
      .col-grow.gt-sm
      .col-auto
        .row.q-gutter-md.full-width
          .col-auto
            small Created: #[p {{ printCreated }}]
            q-tooltip
              p {{ creation.createdAt.toString() }}
          .col-auto(v-if="!creation.customModelName")
            small Model: #[p {{ creation.model }}]
          .col-auto(v-else)
            small Custom Model: #[p {{ creation.customModelName }}]
          .col-auto
            small Aspect Ratio: #[p {{ creation.aspectRatio }}]
          //- .col-auto
          //-   small Quantity: #[p {{ creation.quantity }}]
          .col-grow
          .col-auto(v-if="creation.creatorId == $userAuth.userId")
            p {{ printPrivacy }}
            q-toggle(v-model="creation.public" @click="updatePrivacy()")
  div.relative-position(style="height:30px;" v-else)
    div.full-width(style="position:absolute; bottom:-6px;")
      .centered(style="height:30px;")
        q-btn(icon="keyboard_arrow_down" @click="toggleMinimized()" color="white" flat size="md")

</template>

<script lang="ts">
import CreatedImageCard from "components/CreatedImageCard.vue"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import imageGallery from "lib/imageGallery"
import { img } from "lib/netlifyImg"
import { catchErr, longIdToShort, timeSince } from "lib/util"
import { copyToClipboard, Dialog, Notify, useQuasar } from "quasar"
import { creationsDeleteRequest, creationsSetRequestPrivacy, modelsGetModel, userGetUsername } from "src/lib/orval"
import { type CreateImageRequestWithCustomModel } from "src/stores/createImageStore"
import { useImageCreations } from "src/stores/imageCreationsStore"
import { defineComponent, PropType, ref, Ref } from "vue"
import type { CreateImageRequestData, CreateVideoRequest } from "../../../fiddl-server/dist/lib/types/serverTypes"
import type { UnifiedCreation } from "lib/types"
export default defineComponent({
  components: {
    CreatedImageCard,
    ImageGallery,
  },
  props: {
    minimized: {
      type: Object as PropType<Ref<boolean>>,
      required: false,
      default: () => ref(false),
    },
    creation: {
      type: Object as PropType<UnifiedCreation>,
      required: true,
    },
    creatorUsername: {
      type: String,
      required: false,
      default: "",
    },
    hideLinkBtn: Boolean,
  },
  emits: ["setRequest", "reload", "deleted"],
  setup() {
    const quasar = useQuasar()
    return { quasar: quasar }
  },
  data() {
    return {
      timeSince,
      img,
      localCreatorUsername: this.creatorUsername,
    }
  },
  computed: {
    printPrivacy() {
      return this.creation.public ? "Public" : "Private"
    },
    printCreated() {
      return timeSince(this.creation.createdAt)
    },
  },
  methods: {
    toggleMinimized() {
      console.log("toggle minimized", this.minimized.value)
      this.minimized.value = !this.minimized.value
      console.log("toggle minimized", this.minimized.value)
    },
    copyPrompt() {
      if (!this.creation.prompt) return
      void copyToClipboard(this.creation.prompt)
      Notify.create({
        message: "Prompt Copied",
        color: "positive",
      })
    },
    deleteRequest() {
      Dialog.create({
        title: "Delete Request",
        message: "Are you sure you want to delete this creation?",
        ok: {
          label: "Delete",
          color: "negative",
        },
        cancel: {
          label: "Cancel",
          color: "primary",
        },
      }).onOk(() => {
        void creationsDeleteRequest({ requestId: this.creation.id })
          .catch(catchErr)
          .then((response) => {
            this.$emit("deleted", this.creation.id)
            Notify.create({
              message: "Creation Deleted",
              color: "negative",
            })
            useImageCreations().deleteCreation(this.creation.id)
            if (this.$route.name == "imageRequest") void this.$router.push({ name: "browse" })
          })
      })
    },
    updatePrivacy() {
      console.log("update privacy", this.creation.public)
      void creationsSetRequestPrivacy({ requestId: this.creation.id, public: this.creation.public })
        .catch(catchErr)
        .then((response) => {
          // Notify.create({
          //   message: "Privacy Updated",
          //   color: "positive",
          // })
        })
    },
    goToRequestPage() {
      const shortId = longIdToShort(this.creation.id)
      void this.$router.push({ name: "imageRequest", params: { requestShortId: shortId } })
    },
    async showGallery(startIndex: number) {
      const root = this.$root
      if (!root) return
      const images = this.creation.mediaIds
      let creatorName = this.creatorUsername
      if (creatorName.length == 0) {
        try {
          const response = await userGetUsername({ userId: this.creation.creatorId })
          creatorName = response?.data || ""
        } catch (error) {
          console.error(error)
          creatorName = ""
        }
      }

      const creatorMeta = { id: this.creation.creatorId, username: creatorName }
      await imageGallery.show(images, startIndex, this.creation.id, creatorMeta)
      console.log("gallery closed,trigger reload event")
      this.$emit("reload")
    },
    async setRequest() {
      if (this.creation.prompt == undefined || this.creation.prompt?.length == 0) {
        if (!this.$userAuth.loggedIn) {
          Dialog.create({
            title: "Login Required",
            message: "You need to be logged in to view the request details",
          })
        } else {
          Dialog.create({
            title: "Error",
            message: "You need to unlock at least one image in this request to view the request details",
          })
        }
      } else {
        // void this.$router.push({ name: "create", query: { imageId: this.creation.mediaIds[0] } })
        console.log("set request", this.creation)
        const req: CreateImageRequestWithCustomModel = {
          aspectRatio: (this.creation.aspectRatio as any) || "1:1",
          customModelId: this.creation.customModelId,
          customModelName: this.creation.customModelName,
          model: (this.creation.model as any) || "flux-dev",
          prompt: this.creation.prompt,
          quantity: this.creation.quantity || 1,
          seed: undefined,
          public: this.creation.public,
          negativePrompt: this.creation.negativePrompt,
        }
        if (this.creation.model == "custom" && this.creation.customModelId) {
          let customModel: any = null
          try {
            const response = await modelsGetModel({ id: this.creation.customModelId })
            customModel = response?.data
          } catch (error) {
            console.error(error)
          }
          if (!customModel) {
            req.customModelId = undefined
            req.customModelName = undefined
            req.model = "flux-dev"
            Dialog.create({
              message: "Custom model is private, using flux-dev model instead",
              color: "negative",
              persistent: true,
            })
          }
        }
        const encodedRequest = encodeURIComponent(JSON.stringify(req))
        if (this.$route.name == "create") void this.$router.replace({ query: { requestData: encodedRequest } })
        else void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
      }
    },
  },
})
</script>
