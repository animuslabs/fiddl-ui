<template lang="pug">
//- div.bg-black(style="position:fixed").full-width.full-height.z-max
//- ImageGallery(:images="images" ref="gallery" hidden  )
router-view

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import { Loading, LoadingBar, LocalStorage } from "quasar"
import ImageGallery from "components/dialogs/ImageGallery.vue"
import { toObject } from "lib/util"
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    setTimeout(() => {
      console.clear()
    }, 10)
  })
}
export default defineComponent({
  name: "App",
  components: {
    ImageGallery,
  },
  data() {
    return {
      images: [] as string[],
    }
  },
  watch: {
    "$route.query": {
      immediate: false,
      handler(newQuery) {
        console.log(newQuery)
        const referredBy = this.$route.query?.referredBy as string | undefined
        // console.log(this.$route.query)
        if (!referredBy) return
        LocalStorage.set("referredBy", referredBy)
      },
    },
  },
  created() {
    // this.$userAuth = useUserAuth()
    // console.log(this.$route.query)
  },

  mounted() {
    void useUserAuth().attemptAutoLogin()
    LoadingBar.setDefaults({
      color: "info",
      size: "3px",
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
