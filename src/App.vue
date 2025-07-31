<template lang="pug">
//- div.bg-black(style="position:fixed").full-width.full-height.z-max
//- ImageGallery(:images="images" ref="gallery" hidden  )

router-view(style="z-index:1")
.bg-grid-overlay
.bg-color-base
</template>

<style lang="sass">
.bg-color-base
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-color: rgb(18,18,18)
  z-index: -1

.bg-grid-overlay
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-image: url('/bg-grain.png')
  background-size: 128px
  background-repeat: repeat
  opacity: 0.05
  pointer-events: none
  z-index: 0
</style>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { Loading, LoadingBar, LocalStorage } from "quasar"
import ImageGallery from "src/components/dialogs/MediaViewer.vue"
import { toObject } from "lib/util"
import { usePricesStore } from "src/stores/pricesStore"
// import { useCreateImageStore } from "stores/createImageStore"
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    setTimeout(() => {
      console.clear()
    }, 10)
  })
}
// const createStore = useCreateImageStore()
export default defineComponent({
  name: "App",
  components: {
    ImageGallery,
  },
  data() {
    return {
      images: [] as string[],
      // req: createStore.state.req,
    }
  },
  watch: {
    "$route.query": {
      immediate: false,
      handler(newQuery) {
        // console.log(newQuery)
        const referredBy = this.$route.query?.referredBy as string | undefined
        // console.log(this.$route.query)
        if (!referredBy) return
        LocalStorage.set("referredBy", referredBy)
      },
    },
  },
  created() {
    document.querySelectorAll<HTMLDivElement>(".ssr-metadata").forEach((el) => el.remove())

    // this.$userAuth = useUserAuth()
    // console.log(this.$route.query)
  },

  mounted() {
    void usePricesStore().reloadPrices().catch(console.error)
    void useUserAuth().attemptAutoLogin()
    LoadingBar.setDefaults({
      color: "primary",
      size: "1px",
      position: "top",
      reverse: false,
    })
  },
  methods: {
    openDialog(startingIndex = 0, images: string[]) {
      this.images = toObject(images)
      const gallery = this.$refs.gallery as InstanceType<typeof ImageGallery>
      console.log(gallery)
      gallery.show()
      // gallery.openDialog(startingIndex)
    },
  },
})
</script>
