import { defineStore } from "pinia"
import { ref, computed, watch } from "vue"
import { collectionsLikeImage, collectionsUnlikeImage, creationsHdImage, creationsDeleteImage, creationsGetCreationData, userGetUsername } from "src/lib/orval"
import { img, avatarImg } from "lib/netlifyImg"
import { getImageFromCache, storeImageInCache } from "lib/hdImageCache"
import { Dialog, SessionStorage } from "quasar"
import { catchErr, copyToClipboard, longIdToShort, shareImage, throwErr, updateQueryParams } from "lib/util"
import DownloadImage from "src/components/dialogs/DownloadImage.vue"
import EditImage from "src/components/dialogs/EditImage.vue"
import LikeImage from "src/components/dialogs/LikeImage.vue"
import CreateAvatar from "src/components/dialogs/CreateAvatar.vue"
import { useRouter, useRoute } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"

const userAuth = useUserAuth()

export const useMediaViewerStore = defineStore("mediaViewer", () => {
  const mediaIds = ref<string[]>([])
  const currentIndex = ref(0)
  const imgLoading = ref(true)
  const userOwnsImage = ref(false)
  const userLikedImage = ref(false)
  const loadingLike = ref(false)
  const hdImageLoaded = ref(false)
  const creatorMeta = ref({ id: "", userName: "" })
  const loadedRequestId = ref<string | null>(null)

  const router = useRouter()
  const route = useRoute()

  const currentId = computed(() => mediaIds.value[currentIndex.value] ?? "")
  const currentLg = computed(() => img(currentId.value, "lg"))
  const favoriteBtnColor = computed(() => (userLikedImage.value ? "accent" : userOwnsImage.value ? "grey-5" : "grey-6"))
  const editBtnColor = computed(() => (userOwnsImage.value ? "primary" : "grey-6"))
  const downloadClass = computed(() => (userOwnsImage.value ? "text-primary" : "text-grey-6"))

  async function init(ids: string[], start = 0) {
    mediaIds.value = [...ids]
    currentIndex.value = start
    await loadCreatorMeta()
    await loadHdImage()
    preloadNeighbours()
    watch(currentId, async () => {
      imgLoading.value = true
      await loadCreatorMeta()
      await loadHdImage()
      preloadNeighbours()
    })
  }

  function next() {
    if (mediaIds.value.length > 1 && !imgLoading.value) currentIndex.value = (currentIndex.value + 1) % mediaIds.value.length
  }
  function prev() {
    if (mediaIds.value.length > 1 && !imgLoading.value) currentIndex.value = (currentIndex.value - 1 + mediaIds.value.length) % mediaIds.value.length
  }
  function goTo(i: number) {
    if (i >= 0 && i < mediaIds.value.length) currentIndex.value = i
  }

  async function toggleLike() {
    if (userAuth.loggedIn) {
      Dialog.create({ title: "Login required", message: "You need to login to like images", cancel: true, persistent: true }).onOk(() => {
        void router.push({ name: "login" })
      })
      return
    }
    loadingLike.value = true
    try {
      if (userLikedImage.value) {
        await collectionsUnlikeImage({ imageId: currentId.value })
        userLikedImage.value = false
      } else {
        if (!userOwnsImage.value) {
          Dialog.create({ component: LikeImage, componentProps: { userOwnsImage: userOwnsImage.value, currentImageId: currentId.value } })
          userOwnsImage.value = true
        }
        await collectionsLikeImage({ imageId: currentId.value })
        userLikedImage.value = true
      }
    } finally {
      loadingLike.value = false
    }
  }

  async function loadHdImage(id?: string) {
    if (!id) id = currentId.value
    if (userAuth.loggedIn) return
    userOwnsImage.value = false
    hdImageLoaded.value = false

    let imageData = await getImageFromCache(id)
    if (!imageData) {
      if (SessionStorage.getItem("noHdImage-" + id)) return
      const rsp = await creationsHdImage({ imageId: id }).catch(() => undefined)
      imageData = rsp?.data
      if (imageData) await storeImageInCache(id, imageData)
    }
    if (imageData) {
      userOwnsImage.value = true
      const imgEl = document.querySelector("img[ref='overlayImage']") as HTMLImageElement
      if (imgEl) imgEl.src = `data:image/webp;base64,${imageData}`
      hdImageLoaded.value = true
    }
    imgLoading.value = false
  }

  function preloadNeighbours() {
    const neighbours = [currentIndex.value - 1, currentIndex.value + 1]
    neighbours.forEach((i) => {
      if (i >= 0 && i < mediaIds.value.length) new Image().src = img(mediaIds.value[i] || throwErr("missing mediaId"), "lg")
    })
  }

  async function deleteCurrent() {
    await creationsDeleteImage({ imageId: currentId.value }).catch(catchErr)
    mediaIds.value = mediaIds.value.filter((id) => id !== currentId.value)
    if (currentIndex.value >= mediaIds.value.length) currentIndex.value--
  }

  async function loadCreatorMeta() {
    if (creatorMeta.value.userName) return
    const imgRsp = await creationsGetCreationData({ imageId: currentId.value }).catch(catchErr)
    if (!imgRsp?.data) return
    const meta = imgRsp.data
    const nameRsp = await userGetUsername({ userId: meta.creatorId }).catch(catchErr)
    creatorMeta.value = { id: meta.creatorId, userName: nameRsp?.data || "" }
    loadedRequestId.value = meta.requestId
  }
  function goToRequestPage() {
    if (!loadedRequestId.value) return
    void router.push({ name: "imageRequest", params: { requestShortId: longIdToShort(loadedRequestId.value) } })
  }

  function showDownloadWindow() {
    Dialog.create({ component: DownloadImage, componentProps: { userOwnsImage: userOwnsImage.value, currentImageId: currentId.value } }).onDismiss(() => {
      void loadHdImage()
    })
  }

  function editImage() {
    if (userOwnsImage.value) {
      void router.push({ name: "create", query: { imageId: currentId.value } })
    } else {
      Dialog.create({ component: EditImage, componentProps: { userOwnsImage: userOwnsImage.value, currentImageId: currentId.value } }).onOk(() => {
        void router.push({ name: "create", query: { imageId: currentId.value } })
      })
    }
  }

  async function share() {
    const params: any = { requestShortId: "" }
    const query: any = { index: currentIndex.value }
    const imgRsp = await creationsGetCreationData({ imageId: currentId.value }).catch(catchErr)
    const reqId = imgRsp?.data?.requestId
    if (!reqId) return
    params.requestShortId = longIdToShort(reqId)
    await userAuth.loadUserProfile()
    if (userAuth.loggedIn && userAuth.userProfile?.username) query.referredBy = userAuth.userProfile.username
    const url = router.resolve({ name: "imageRequest", params, query }).href
    copyToClipboard(window.location.origin + url)
    Dialog.create({ title: "Image URL Copied", message: "Link copied to clipboard." })
  }

  async function mobileShare() {
    await shareImage("Fiddl.art Creation", "Check out this creation on Fiddl.art", currentLg.value, currentId.value + "-fiddl-art.webp")
  }

  function setProfileImage() {
    Dialog.create({ component: CreateAvatar, componentProps: { userOwnsImage: userOwnsImage.value, currentImageId: currentId.value } })
  }

  return {
    mediaIds,
    currentIndex,
    imgLoading,
    userOwnsImage,
    userLikedImage,
    loadingLike,
    creatorMeta,
    currentId,
    currentLg,
    favoriteBtnColor,
    editBtnColor,
    downloadClass,
    init,
    next,
    prev,
    goTo,
    toggleLike,
    deleteCurrent,
    loadHdImage,
    showDownloadWindow,
    editImage,
    share,
    mobileShare,
    setProfileImage,
    goToRequestPage,
    loadedRequestId,
  }
})
