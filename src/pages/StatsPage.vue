<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-sm
    h4 Stats

  div(v-if="$userAuth.loggedIn && $userAuth.userData?.admin")
    .centered.q-mt-md.q-gutter-md
      q-btn(label="refresh" @click="load()" icon="refresh")
      q-btn(label="get admin jwt" @click="getJwt()" icon="content_copy")
    .centered.q-gutter-lg.q-ma-md
      .col(style="overflow: auto; min-width:400px;")
        h2 Users
        pre(style="font-size: 20px;") {{ stats.users }}
      .col(style="overflow: auto; min-width:400px;")
        h2 Images
        pre(style="font-size: 20px;") {{ stats.images }}
      .col(style="overflow: auto; min-width:400px;")
        h2 Collections
        pre(style="font-size: 20px;") {{ stats.collections }}
      .col(style="overflow: auto; min-width:400px;")
        h2 Payments
        pre(style="font-size: 20px;") {{ stats.payments }}

  .centered.q-gutter-lg.q-ma-md(v-else)
    h2 You need to be logged in as an admin to view this page





</template>

<script lang="ts">
import { jwt } from "lib/jwt"
import { copyToClipboard, Dialog } from "quasar"
import { defineComponent } from "vue"
import { statsUsers, statsImages, statsCollections, statsPayments } from "src/lib/orval"

export default defineComponent({
  components: {},
  data() {
    return {
      stats: {} as any,
    }
  },
  watch: {
    "$userAuth.loggedIn": {
      immediate: true,
      handler(val) {
        if (val) void this.load()
      },
    },
  },

  mounted() {},
  methods: {
    getJwt() {
      const jwtObj = jwt.read()
      if (!jwtObj) alert("no jwt found")
      else {
        void copyToClipboard(jwtObj.token)
        Dialog.create({
          // title: "Copied to clipboard",
          message: "The jwt has been copied to the clipboard",
        })
      }
    },
    async load() {
      const usersResponse = await statsUsers()
      this.stats.users = usersResponse.data

      const imagesResponse = await statsImages()
      this.stats.images = imagesResponse.data

      const collectionsResponse = await statsCollections()
      this.stats.collections = collectionsResponse.data

      const paymentsResponse = await statsPayments()
      this.stats.payments = paymentsResponse.data

      // const apiMetricsResponse = await statsApiMetrics()
      // this.stats.apiMetrics = apiMetricsResponse.data
    },
  },
})
</script>
