<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" maximized :persistent="isPersistent" )
  q-card.q-dialog-plugin(style="width:90vw;" @click="hide()").bg-transparent
    .full-width(style="height:5vh").gt-sm
    .relative-position
      //- q-spinner.absolute-center(size="100px")
      .centered.q-mb-md.q-mt-lg.relative-position(:style="{visibility: downloadMode ? 'hidden' : 'visible'}")
        div
          q-btn(icon="share"  flat @click.native.stop="share()" round color="grey-5")
        q-btn(icon="sym_o_info" flat round @click.native.stop="goToRequestPage()" color="grey-5" v-if="loadedRequestId")
        div
          q-btn(icon="download"  flat @click.native.stop="showDownloadWindow()" round :class="downloadClass")
            q-tooltip
              p(v-if="userOwnsImage") You own the 4k download
              p(v-else) Download Image
        q-btn(icon="edit" flat round @click.native.stop="editImage()" :color="editBtnColor")
        q-btn(icon="sym_o_favorite" flat round @click.native.stop="likeImage()" :color="favoriteBtnColor" :loading="loadingLike")
        //- q-btn(icon="more_vert" flat round @click.native.stop="likeImage()" color="grey-5")
        div.relative-position
          //- div {{menu}}
          q-btn(
            icon="more_vert"
            round
            flat
            color="grey-5"
            @click.stop="menu = true"
          )
            q-menu(
              v-if="menu"
              anchor="bottom right"
              self="top right"
              @click.native.stop="menu = false"
            )
              q-list
                q-item(clickable @click="setProfileImage()" v-close-popup)
                  q-item-section
                    .row.items-center
                      q-icon(name="account_circle" size="20px").q-mr-md
                      div Use as Profile Image
                q-item(clickable @click="deleteImage()" v-close-popup v-if="userCreatedImage")
                  q-item-section
                    .row.items-center
                      q-icon(name="delete" size="20px").q-mr-md
                      div Delete
            //- q-item(clickable @click="$router.push({name:'creations',params:{ accountId:userAuth.userId }})" v-close-popup)
            //-   q-item-section
            //-     .row.items-center
            //-       q-icon(name="photo_library" size="20px").q-mr-md
            //-       div My Account
            //- q-item(clickable @click="userAuth.logout()" v-close-popup)
            //-   q-item-section
            //-     .row.items-center
            //-       q-icon(name="logout" size="20px").q-mr-md
            //-       div  Logout
        //- q-btn(icon="add" flat @click="closeFullScreen")
        div
          q-btn(icon="close" flat @click.native.stop="hide" round color="grey-5")
      //- q-img.overlay-image(:src="images[currentIndex]" alt="Full Screen Image"  no-transition @click="onImageClick" ref="overlayImage")
    .centered
      div.relative-position
        transition(name="fade")
          q-linear-progress.absolute-top.full-width( style="top:-2px;" indeterminate v-if="imgLoading || loading" color="teal-9" track-color="transparent" )
        img.image-darken(:src="currentImageUrl" @click.native.stop="onImageClick" ref="overlayImage" @load="imgLoaded" alt="user created image" style="width:100%; max-height: 75vh; object-fit: contain;" :class="imgClass")
        .row(v-if="creatorMeta && !userOwnsImage" style="bottom:-0px" @click="goToCreator()").items-center.q-ma-md.absolute-bottom
          .col-auto.q-pa-sm.cursor-pointer(style="border-radius:10%; background-color:rgba(0,0,0,0.5);")
            .row.items-center
              q-img( :src="avatarImg(creatorMeta.id)" style="width:50px; height:50px; border-radius:50%;").q-mr-sm
              h4.q-mr-sm @{{creatorMeta.username}}
    .centered
        div.q-mt-md(v-if="localImageIds.length > 1 && !downloadMode && localImageIds.length < 11")
          span.indicator( v-for="(image, index) in localImageIds" :key="index" :class="{ active: index === currentIndex }" @click.native.stop="goTo(index)")
</template>
<style>
.fade-enter-active {
  transition: opacity 0.5s ease 0.5s; /* 0.5s delay before the 0.5s transition */
}
.fade-enter {
  opacity: 0;
}
.fade-enter-to {
  opacity: 1;
}
.image-darken {
  background-color: transparent;
  color: transparent;
  transition: filter 0.5s ease;
}
.image-darken.active {
  filter: brightness(50%);
}
</style>

<script lang="ts">
import { log } from "console"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import { catchErr, copyToClipboard, downloadFile, downloadImage, extractImageId, generateShortHash, longIdToShort, updateQueryParams } from "lib/util"
import { Dialog, Loading, QDialog, SessionStorage } from "quasar"
import { defineComponent, PropType } from "vue"
import DownloadImage from "./DownloadImage.vue"
import { avatarImg, img } from "lib/netlifyImg"
import EditImage from "./EditImage.vue"
import LikeImage from "./LikeImage.vue"
import CreateAvatar from "src/components/dialogs/CreateAvatar.vue"
export default defineComponent({
  props: {
    imageIds: {
      type: Array as () => string[],
      required: true,
    },
    imageRequestId: {
      type: String,
      default: "",
      required: false,
    },
    startIndex: {
      type: Number,
      default: 0,
      required: false,
    },
    creatorMeta: {
      type: Object as PropType<{ id: string; username: string } | null>,
      default: null,
    },
  },
  emits: ["ok", "hide"],
  data() {
    return {
      localImageIds: [] as string[],
      avatarImg,
      imageDeleted: false,
      menu: true,
      isPersistent: false,
      preloaded: false,
      downloadMode: false,
      imgLoading: true,
      userOwnsImage: false,
      loading: false,
      currentIndex: 0,
      isFullScreen: false,
      touchStartX: 0,
      firstImageLoaded: false,
      touchEndX: 0,
      upscaling: false,
      threshold: 50, // Minimum swipe distance
      userLikedImage: false,
      loadingLike: false,
      loadedRequestId: null as string | null,
    }
  },
  computed: {
    currentImageUrl() {
      return img(this.currentImageId, "lg")
    },
    userCreatedImage() {
      if (!this.creatorMeta) return false
      return this.creatorMeta.id == this.$userAuth.userId
    },
    imgClass() {
      if (!this.firstImageLoaded) return ""
      else return this.loading || this.imgLoading ? "image-darken active" : "image-darken"
    },
    favoriteBtnColor() {
      return this.userLikedImage ? "accent" : this.userOwnsImage ? "grey-5" : "grey-6"
    },
    editBtnColor() {
      return this.userOwnsImage ? "primary" : "grey-6"
    },
    downloadClass() {
      return this.userOwnsImage ? "text-primary" : "text-grey-6"
    },
    currentImageId() {
      if (this.localImageIds.length === 0) return ""
      return this.localImageIds[this.currentIndex] as string
    },
  },
  watch: {
    imageRequestId: {
      handler(val: string) {
        if (!val) return
        this.loadedRequestId = val
      },
      immediate: true,
    },
    currentImageId: {
      async handler(val: string) {
        if (!this.$userAuth.loggedIn) return
        console.log("current id triggered")
        this.userLikedImage = false
        this.loadingLike = true
        this.userLikedImage = await this.$api.collections.imageInUsersCollection.query({ imageId: val, name: "likes" })
        this.loadingLike = false
        // dialog.persistent = true
        if (this.$route.name == "imageRequest") {
          const query = { index: this.currentIndex }
          const newQuery = { ...this.$route.query, ...query }
          void this.$nextTick(() => {
            updateQueryParams(newQuery)
          })
        }
      },
      immediate: true,
    },
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown)
  },
  mounted() {
    this.localImageIds = [...this.imageIds]
    this.currentIndex = this.startIndex
    this.preloadImages()
    window.addEventListener("keydown", this.handleKeyDown)
  },
  methods: {
    deleteImage() {
      Dialog.create({
        title: "Delete Image",
        message: "Are you sure you want to delete this image?",
        ok: {
          label: "Delete",
          color: "negative",
        },
        cancel: {
          label: "Cancel",
          color: "primary",
        },
      }).onOk(() => {
        this.loading = true
        this.imageDeleted = true
        void this.$api.creations.deleteImage.mutate(this.currentImageId).catch(catchErr)
        this.localImageIds = this.localImageIds.filter((el) => el !== this.currentImageId)
        if (this.localImageIds.length == 0) this.hide()
        else this.next()
        this.loading = false
      })
    },
    async loadRequestId() {
      if (this.imageRequestId) return
      const imageMeta = await this.$api.creations.imageData.query(this.currentImageId).catch(catchErr)
      if (!imageMeta) return
      this.loadedRequestId = imageMeta.imageRequestId
    },
    goToCreator() {
      if (!this.creatorMeta) return
      void this.$router.push({ name: "profile", params: { username: this.creatorMeta.username } })
    },
    setProfileImage() {
      console.log("setProfileImage")
      Dialog.create({ component: CreateAvatar, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentImageId } })
    },
    goToRequestPage() {
      if (!this.loadedRequestId || this.loadedRequestId.length == 0) return
      this.hide()
      void this.$router.push({ name: "imageRequest", params: { requestShortId: longIdToShort(this.loadedRequestId) } })
    },
    likeImage() {
      // if (!this.$userAuth.loggedIn) return
      if (!this.userOwnsImage) {
        Dialog.create({ component: LikeImage, componentProps: { currentImageId: this.currentImageId } })
          .onOk(async () => {
            await this.loadHdImage() // this will set userOwnsImage to true
            this.likeImage()
          })
          .onCancel(() => {
            this.hide()
          })
      } else {
        this.userLikedImage = !this.userLikedImage
        if (this.userLikedImage) void this.$api.collections.likeImage.mutate(this.currentImageId)
        else void this.$api.collections.unlikeImage.mutate(this.currentImageId)
      }
    },
    editImage() {
      if (this.userOwnsImage) {
        void this.$router.push({ name: "create", query: { imageId: this.currentImageId } })
        this.hide()
      } else {
        Dialog.create({ component: EditImage, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentImageId } }).onOk(() => {
          void this.$router.push({ name: "create", query: { imageId: this.currentImageId } })
          this.hide()
        })
      }
    },
    showDownloadWindow() {
      Dialog.create({ component: DownloadImage, componentProps: { userOwnsImage: this.userOwnsImage, currentImageId: this.currentImageId } }).onDismiss(() => {
        void this.loadHdImage()
      })
    },
    async loadHdImage(val?: string) {
      if (!val) val = this.currentImageId
      if (!this.$userAuth.loggedIn) return
      this.userOwnsImage = false
      let imageData = getImageFromCache(val)
      if (!imageData) {
        if (SessionStorage.getItem("noHdImage-" + val)) return
        this.loading = true
        imageData =
          (await this.$api.creations.hdImage.query(val).catch(() => {
            SessionStorage.setItem("noHdImage-" + val, true)
          })) || undefined
        this.loading = false
        if (!imageData) return
        storeImageInCache(val, imageData)
      }
      this.userOwnsImage = true
      const imageDataUrl = `data:image/webp;base64,${imageData}`
      void this.$nextTick(() => {
        const img = this.$refs.overlayImage as HTMLImageElement
        if (img) img.src = imageDataUrl
      })
    },
    preloadImages() {
      if (this.localImageIds.length > 9) return
      // this.localImageIds.forEach((src, index) => {
      //   if (index !== this.currentIndex) {
      //     const img = new Image()
      //     img.src = src
      //   }
      // })
    },
    async imgLoaded(event: Event) {
      await this.loadHdImage()
      this.firstImageLoaded = true
      this.imgLoading = false
      if (this.preloaded) return
      this.preloaded = true
      this.preloadImages()
      await this.loadRequestId()
    },
    downloadImage() {
      // const currentImage = this.images[this.currentIndex as number]
      // if (!currentImage) return
      // downloadImage(currentImage, "fiddl.art-" + extractImageId(currentImage) + ".webp")
      // Dialog.create({ component: DownloadImage })
    },
    async share() {
      let params: any = { requestShortId: "" }
      let query: any = { index: this.currentIndex }
      let imageRequestId = this.imageRequestId
      if (!imageRequestId) {
        const imageMeta = await this.$api.creations.imageData.query(this.currentImageId).catch(catchErr)
        if (!imageMeta) return
        imageRequestId = imageMeta.imageRequestId
        params.requestShortId = longIdToShort(imageRequestId)
      } else {
        params.requestShortId = longIdToShort(imageRequestId)
      }
      const request = await this.$api.creations.createRequest.query(imageRequestId)
      // find the index of this image in the request
      const imageIndex = request.imageIds.findIndex((el) => el == this.currentImageId) || 0
      query.index = imageIndex
      await this.$userAuth.loadUserProfile()
      const hasUsername = !!(this.$userAuth.loggedIn && this.$userAuth.userProfile?.username)
      if (hasUsername) query.referredBy = this.$userAuth.userProfile?.username
      const url = this.$router.resolve({ name: "imageRequest", params, query }).href
      const fullUrl = window.location.origin + url
      console.log("share", fullUrl)
      copyToClipboard(fullUrl)
      Dialog.create({
        title: "Image URL Copied",
        message: "The image URL has been copied to your clipboard. If you are logged in with a username set then your refferal link is also included in the url.",
        position: "top",
      })
    },
    openDialog(startingIndex = 0) {
      this.currentIndex = startingIndex
      this.isFullScreen = true
    },
    next() {
      if (this.localImageIds.length == 1) return
      // console.log("next", this.loading, this.imgLoading)
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex + 1) % this.localImageIds.length
    },
    prev() {
      if (this.localImageIds.length == 1) return
      if (this.loading || this.imgLoading) return
      this.imgLoading = true
      this.currentIndex = (this.currentIndex - 1 + this.localImageIds.length) % this.localImageIds.length
    },
    goTo(index: number) {
      this.currentIndex = index
    },
    openFullScreen() {
      this.isFullScreen = true
    },
    closeFullScreen() {
      this.isFullScreen = false
      this.downloadMode = false
    },

    onImageClick(event: MouseEvent) {
      console.log("click")
      const target = event.target as HTMLElement
      const rect = target.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const width = rect.width
      console.log(clickX)
      if (clickX < width / 2) {
        this.prev()
      } else {
        this.next()
      }
    },
    handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          this.prev()
          break
        case "ArrowRight":
          this.next()
          break
        case "Escape":
          this.closeFullScreen()
          break
        default:
          break
      }
    },
    onTouchStart(e: TouchEvent) {
      if (!e.changedTouches[0]) return
      this.touchStartX = e.changedTouches[0].screenX
    },
    onTouchMove(e: TouchEvent) {
      if (!e.changedTouches[0]) return
      this.touchEndX = e.changedTouches[0].screenX
    },
    onTouchEnd() {
      // console.log("touchEnd")
      // const distance = this.touchEndX - this.touchStartX
      // if (Math.abs(distance) > this.threshold) {
      //   if (distance > 0) {
      //     this.prev()
      //   } else {
      //     this.next()
      //   }
      // }
      // this.touchStartX = 0
      // this.touchEndX = 0
    },
    show() {
      const dialog = this.$refs.dialog as QDialog
      dialog.show()
    },
    hide() {
      const dialog = this.$refs.dialog as QDialog
      if (this.imageDeleted) window.location.reload()
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

<style lang="sass" scoped>
.hover-areas
  position: absolute
  top: 0
  left: 0
  width: 100%
  height: 100%
  display: flex

.left-area
  cursor: w-resize

.right-area
  cursor: e-resize

.indicators
  display: flex
  justify-content: center

.carousel
  position: relative
  width: 100%
  max-width: 600px
  margin: auto
  overflow: hidden

.carousel-container
  position: relative
  user-select: none

.overlay-image
  // width: 1000px
  // height:2000px
  object-fit: contain
  max-width: 90vw
  max-height: calc(85vh - 50px)

.prev-button, .next-button
  position: absolute
  top: 50%
  transform: translateY(-50%)
  background-color: rgba(0, 0, 0, 0.5)
  border: none
  color: white
  padding: 10px
  cursor: pointer
  font-size: 24px
  border-radius: 50%

.prev-button
  left: 10px

.next-button
  right: 10px

.indicators
  text-align: center
  position: absolute
  bottom: -20px
  width: 100%

.indicator
  display: inline-block
  height: 10px
  width: 10px
  margin: 0 5px 0px
  background-color: rgba(255, 255, 255, 0.5)
  border-radius: 50%
  cursor: pointer

.active
  background-color: rgba(255, 255, 255, 1)

.overlay
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-color: rgba(0, 0, 0, 0.9)
  display: flex
  justify-content: center
  align-items: center

.overlay-content
  position: relative
  // width: 95%
  max-width: 1900px
  max-height: 95%


@media (max-width: 600px)
  .prev-button, .next-button
    padding: 8px
    font-size: 20px
</style>
