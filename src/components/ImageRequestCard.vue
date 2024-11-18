<template lang="pug">
q-card(style="overflow:auto").q-mb-md.q-pr-md.q-pl-md.q-pb-lg
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
    .col(style="min-width:220px;")
      small Prompt: #[p.ellipsis-3-lines {{ creation.request.prompt }}]
      p.text-italic.text-positive(v-if="creation.request.prompt == undefined || creation.request.prompt.length==0") Purchase any image to unlock the prompt
    .col-grow.gt-sm
    .col-auto
      .row.q-gutter-md
        .col-auto
          small Created: #[p {{ timeSince(creation.createdAt) }}]
          q-tooltip
            p {{ creation.createdAt.toString() }}
        .col-auto
          small Model: #[p {{ creation.request.model }}]
        .col-auto
          small Aspect Ratio: #[p {{ creation.request.aspectRatio }}]
        .col-auto
          small Quantity: #[p {{ creation.request.quantity }}]
        .col-auto(v-if="creation.creatorId != $userAuth.userId")
          small Private: #[p {{ !creation.request.public }}]
        .col-auto(v-else)
          q-toggle(v-model="creation.request.public" @click="updatePrivacy()")
          p {{ printPrivacy() }}

</template>

<script lang="ts">
import { defineComponent } from "vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { catchErr, longIdToShort, timeSince, toObject } from "lib/util"
import { PropType } from "vue"
import { CreatedItem } from "lib/types"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import { img } from "lib/netlifyImg"
import imageGallery from "lib/imageGallery"
import { Dialog, Notify } from "quasar"
export default defineComponent({
  components: {
    CreatedImageCard,
    ImageGallery,
  },
  props: {
    creation: {
      type: Object as PropType<CreatedItem>,
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
  methods: {
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
        this.$api.creations.deleteRequest
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
      console.log("update privacy", this.creation.request.public)
      this.$api.creations.setRequestPrivacy
        .mutate({ requestId: this.creation.id, public: this.creation.request.public })
        .catch(catchErr)
        .then(() => {
          // Notify.create({
          //   message: "Privacy Updated",
          //   color: "positive",
          // })
        })
    },
    printPrivacy() {
      return this.creation.request.public ? "Public" : "Private"
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
      if (this.creation.request.prompt == undefined) {
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
        const req = toObject(this.creation.request)
        req.seed = undefined
        console.log("set request", req)
        this.$emit("setRequest", req)
      }
    },
  },
})
</script>
