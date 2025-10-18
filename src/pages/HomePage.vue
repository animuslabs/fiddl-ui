<template lang="pug">
q-page.q-pa-md
  .centered.q-mx-auto(style="max-width:1200px; width:100%")
    .row.items-center.justify-between.q-mb-md
      h5.q-mr-sm Home
      //- Staged at /home; no quick actions per requirements
    RecentCreationsStrip.q-mb-xl
    UnlockUpvoteFeed
</template>

<script lang="ts">
import { defineComponent } from "vue"
import RecentCreationsStrip from "../components/home/RecentCreationsStrip.vue"
import UnlockUpvoteFeed from "../components/home/UnlockUpvoteFeed.vue"

export default defineComponent({
  name: "HomePage",
  components: { RecentCreationsStrip, UnlockUpvoteFeed },
})
</script>

