<template lang="pug">
  .row.items-center.absolute-bottom(
    v-if="viewer.creatorMeta.userName && !viewer.userOwnsImage"
  )
    .col-auto.q-pa-sm.cursor-pointer(
      style="background-color:rgba(0,0,0,0.5);"
      @click="openProfile"
    )
      .row.items-center.q-mb-xs
        q-img(
          placeholder-src="/blankAvatar.webp"
          :src="avatarImg(viewer.creatorMeta.id)"
          style="width:30px;height:30px;border-radius:50%;"
        ).q-mr-sm
        h6.q-mr-sm @{{ viewer.creatorMeta.userName }}

  div.q-mt-md.text-center(v-if="viewer.mediaIds.length > 1")
    span.indicator(
      v-for="(id, i) in viewer.mediaIds"
      :key="id"
      :class="{ active: i === viewer.currentIndex }"
      @click.native.stop="viewer.goTo(i)"
    )
  </template>

<script lang="ts" setup>
import { useMediaViewerStore } from "stores/mediaViewerStore"
import { avatarImg } from "lib/netlifyImg"
import { useRouter } from "vue-router"

const viewer = useMediaViewerStore()
const router = useRouter()

function openProfile() {
  if (viewer.creatorMeta.userName) void router.push({ name: "profile", params: { username: viewer.creatorMeta.userName } })
}
</script>

<style scoped>
.indicator {
  display: inline-block;
  height: 10px;
  width: 10px;
  margin: 0 5px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  cursor: pointer;
}
.active {
  background: rgba(255, 255, 255, 1);
}
</style>
