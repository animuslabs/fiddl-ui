<template lang="pug">
q-card(style="overflow:auto").q-mb-md.q-pr-md.q-pl-md.q-pb-lg
  //- div custom model id: {{ creation.customModelId }}
  //- div custom model name: {{ creation.customModelName }}
  .row.full-width.q-pt-md.q-pb-md
    div(v-if="creation.imageIds.length < 1").full-width
      .centered.q-ma-xl
        h4.text-accent No images in this creation
    .col( v-for="(imageId,index) in creation.imageIds" :key="imageId" style="max-width:300px; min-width:200px;").gt-sm.q-pa-sm
      CreatedImageCard.cursor-pointer( :imageId="imageId" @click="showGallery(index)" )
    .col( v-for="(imageId,index) in creation.imageIds" :key="imageId" style="max-width:300px; min-width:100px; ").lt-md.q-pa-sm
      CreatedImageCard.cursor-pointer( :imageId="imageId" @click="showGallery(index)" )
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
          p.text-italic.text-positive(v-if="!creation") Purchase any image to unlock the prompt
          .absolute-bottom-right
            q-btn(icon="content_copy" round size="sm" color="grey-10" @click="copyPrompt" v-if="creation.prompt?.length").text-grey-6
              q-tooltip
                p Copy Prompt
    .col-grow.gt-sm
    .col-auto
      .row.q-gutter-md
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
        .col-auto(v-if="creation.creatorId != $userAuth.userId")
          small Private: #[p {{ !creation.public }}]
        .col-auto(v-else)
          p {{ printPrivacy }}
          q-toggle(v-model="creation.public" @click="updatePrivacy()")

</template>

<script lang="ts">
import { defineComponent } from "vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { catchErr, longIdToShort, timeSince, toObject } from "lib/util"
import { PropType } from "vue"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import { img } from "lib/netlifyImg"
import imageGallery from "lib/imageGallery"
import { copyToClipboard, Dialog, Notify } from "quasar"
import { CreateImageRequest, CreateImageRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import { useCreateCardStore } from "src/stores/createCardStore"
export default defineComponent({
  components: {
    CreatedImageCard,
    ImageGallery,
  },
  props: {
    creation: {
      type: Object as PropType<CreateImageRequestData>,
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
        void this.$api.creations.deleteRequest
          .mutate(this.creation.id)
          .catch(catchErr)
          .then(() => {
            this.$emit("deleted", this.creation.id)
            Notify.create({
              message: "Creation Deleted",
              color: "negative",
            })
          })
      })
    },
    updatePrivacy() {
      console.log("update privacy", this.creation.public)
      void this.$api.creations.setRequestPrivacy
        .mutate({ requestId: this.creation.id, public: this.creation.public })
        .catch(catchErr)
        .then(() => {
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
      const images = this.creation.imageIds
      let creatorName = this.creatorUsername
      if (creatorName.length == 0) creatorName = (await this.$api.user.getUsername.query(this.creation.creatorId).catch(console.error)) || ""
      const creatorMeta = { id: this.creation.creatorId, username: creatorName }
      await imageGallery.show(images, startIndex, this.creation.id, creatorMeta)
      console.log("gallery closed,trigger reload event")
      this.$emit("reload")
    },
    setRequest() {
      if (this.creation.prompt == undefined) {
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
        // void this.$router.push({ name: "create", query: { imageId: this.creation.imageIds[0] } })
        console.log("set request", this.creation)
        const req: CreateImageRequest = {
          aspectRatio: (this.creation.aspectRatio as any) || "1:1",
          customModelId: this.creation.customModelId,
          model: (this.creation.model as any) || "flux-dev",
          prompt: this.creation.prompt,
          quantity: this.creation.quantity || 1,
          seed: undefined,
          public: this.creation.public,
          negativePrompt: this.creation.negativePrompt,
        }
        const encodedRequest = encodeURIComponent(JSON.stringify(req))
        if (this.$route.name == "create") void this.$router.replace({ query: { requestData: encodedRequest } })
        else void this.$router.push({ name: "create", query: { requestData: encodedRequest } })
      }
    },
  },
})
</script>
