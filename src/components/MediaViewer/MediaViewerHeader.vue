<template lang="pug">
  .centered.q-mb-md.q-mt-lg.relative-position.items-center
    // Share button & menu
    q-btn(icon="share" round flat color="grey-5" @click.stop="shareMenu = !shareMenu")
    q-menu(v-model="shareMenu" anchor="bottom left" self="top left")
      q-list
        q-item(clickable @click.native.stop="viewer.mobileShare" v-close-popup)
          q-item-section
            .row.items-center
              q-icon(name="image" size="20px").q-mr-md
              div Share Image
        q-item(clickable @click="viewer.share" v-close-popup)
          q-item-section
            .row.items-center
              q-icon(name="content_copy" size="20px").q-mr-md
              div Copy Link

    // Info button (links to request page)
    q-btn(icon="sym_o_info" flat round color="grey-5"
          v-if="viewer.loadedRequestId"
          @click="viewer.goToRequestPage")

    // Download / Edit / Like
    q-btn(icon="download" flat round :class="viewer.downloadClass" @click.stop="viewer.showDownloadWindow")
    q-btn(icon="edit"     flat round :color="viewer.editBtnColor" @click.stop="viewer.editImage")
    q-btn(icon="sym_o_favorite" flat round
          :color="viewer.favoriteBtnColor"
          :loading="viewer.loadingLike"
          @click.stop="viewer.toggleLike")

    // More-options menu
    q-btn(icon="more_vert" round flat color="grey-5" @click.stop="moreOptions = !moreOptions")
      q-menu(v-model="moreOptions" anchor="bottom right" self="top right")
        q-list
          q-item(clickable @click="viewer.setProfileImage" v-close-popup)
            q-item-section
              .row.items-center
                q-icon(name="account_circle" size="20px").q-mr-md
                div Use as Profile Image
          q-item(clickable @click="viewer.deleteCurrent" v-close-popup v-if="userCreatedImage")
            q-item-section
              .row.items-center
                q-icon(name="delete" size="20px").q-mr-md
                div Delete

    // Close button (emits to parent so dialog hides)
    q-btn(icon="close" flat round color="grey-5" @click.stop="$emit('close')")
  </template>

<script lang="ts" setup>
import { ref, computed } from "vue"
import { useMediaViewerStore } from "stores/mediaViewerStore"
import { useUserAuth } from "stores/userAuth"
const userAuth = useUserAuth()

const viewer = useMediaViewerStore()

const shareMenu = ref(false)
const moreOptions = ref(false)

// Helper: did *current* image belong to logged-in user?
const userCreatedImage = computed(() => viewer.creatorMeta.id && viewer.creatorMeta.id === userAuth.userId)
</script>
