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
    .centered.q-ma-md
      .col
        h2 API Metrics
        div(style="font-size: 15px; word-wrap: break-word; max-width:90vw;") {{ stats.apiMetrics }}

  .centered.q-gutter-lg.q-ma-md(v-else)
    h2 You need to be logged in as an admin to view this page





</template>

<script lang="ts">
import { jwt } from "lib/jwt"
import { copyToClipboard, Dialog } from "quasar"
import { defineComponent } from "vue"

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
      this.stats.users = await this.$api.stats.users.query()
      this.stats.images = await this.$api.stats.images.query()
      this.stats.collections = await this.$api.stats.collections.query()
      this.stats.payments = await this.$api.stats.payments.query()
      this.stats.apiMetrics = await this.$api.stats.apiMetrics.query()
    },
  },
})
</script>
