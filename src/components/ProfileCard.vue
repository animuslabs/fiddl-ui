<template lang="pug">
  q-card.q-pa-md
    .row(style="max-width: 90vw;")
      div
        img(:src="profileImage" alt="Profile" style="width: 250px; height: 250px; border-radius: 50%; ")
      div.q-ml-lg
        .row.q-mb-sm.q-gutter-md.items-center
          h4 @{{profile.profile.username}}
          q-btn(icon="edit" round size="sm" flat v-if="$userAuth.userId === userId" @click="$router.push({name:'settings'})")
        .row.q-gutter-md
          div
            div(style="font-weight: bold;") {{profile.imagesCreated}}
            div(style="font-size: 12px;") Created Images
          div
            div(style="font-weight: bold;") {{ profile.imagesFavorited }}
            div(style="font-size: 12px;") Favorited
            q-tooltip
              p Creations favorited by @{{profile.profile.username}}
          div
            div(style="font-weight: bold;") {{ favoritesCount }}
            div(style="font-size: 12px;") Favorites Received
            q-tooltip
              p Creations of @{{profile.profile.username}} favorited by others
        div(v-if="profile.profile.bio").q-mt-md
          .row
            p {{ profile.profile.bio }}
</template>

<script lang="ts">
import { PublicProfile, UserProfile } from "lib/api"
import { avatarImg } from "lib/netlifyImg"
import { PropType } from "vue"
export default {
  props: {
    profile: {
      type: Object as PropType<PublicProfile>,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    favoritesCount: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  data() {
    return {}
  },
  computed: {
    profileImage() {
      return avatarImg(this.userId, 100)
    },
  },
}
</script>
