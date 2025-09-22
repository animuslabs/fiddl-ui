<template lang="pug">
q-dialog(ref="dialog" @hide="onDialogHide" :maximized="isScreenLtMd")
  q-card.q-dialog-plugin(:style="cardStyle")
    div.q-pa-md
      .row.items-center.justify-between.q-mb-sm
        h5.q-mt-none.q-mb-none Request Details
        q-btn(icon="close" flat round @click="hide()")
      div(v-if="!creation")
        .centered.q-pa-lg
          q-spinner(color="primary")
      div(v-else)
        //- Reuse the existing request card but hide the media grid
        ImageRequestCard(:creation="creation" hideLinkBtn :hideMediaGrid="true" @reload="onReload")
        p.q-mb-xs Author
        div
          .row.q-gutter-md.items-center.cursor-pointer.q-pa-sm.bg-grey-10(
            style="border-radius: 10px;"
            v-if="creatorUsername"
            @click="$router.push({ name: 'profile', params: { username: creatorUsername } })"
          )
            q-img(:src="avatarImg(creation?.creatorId)" style="width: 50px; height: 50px; border-radius: 50%;").q-mt-md
            h6 @{{ creatorUsername }}
      .centered.q-pt-md.q-pb-sm
        q-btn(color="grey" flat label="< back" @click="hide()")
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue"
import { QDialog } from "quasar"
import ImageRequestCard from "src/components/MediaRequestCard.vue"
import type { UnifiedRequest, MediaType } from "lib/types"
import { getCreationRequest } from "lib/util"
import { userGetUsername } from "lib/orval"
import { avatarImg } from "lib/netlifyImg"
import { viewportHeight } from "src/lib/viewport"

export default defineComponent({
  components: {
    ImageRequestCard,
  },
  props: {
    requestId: {
      type: String,
      required: true,
    },
    type: {
      type: String as PropType<MediaType>,
      required: true,
    },
  },
  emits: ["hide", "ok"],
  data() {
    return {
      creation: null as UnifiedRequest | null,
      creatorUsername: "" as string | null,
      avatarImg,
    }
  },
  computed: {
    isScreenLtMd(): boolean {
      const screen = (this.$q as typeof this.$q & { screen?: { lt?: Record<string, boolean> } }).screen
      return Boolean(screen?.lt?.md)
    },
    cardStyle(): Record<string, string> {
      if (this.isScreenLtMd) {
        const dynamicHeight = viewportHeight(100)
        return { width: "100vw", maxWidth: "100vw", height: dynamicHeight, maxHeight: dynamicHeight, overflow: "auto" }
      }
      return { width: "800px", maxWidth: "95vw" }
    },
  },
  async mounted() {
    try {
      this.creation = await getCreationRequest(this.requestId, this.type)
      const userResponse = await userGetUsername({ userId: this.creation.creatorId })
      this.creatorUsername = userResponse?.data || null
    } catch (e) {
      console.error(e)
    }
  },
  methods: {
    onReload() {
      // bubbled from MediaRequestCard when gallery closes; no-op here
    },
    show() {
      const dialog = this.$refs.dialog as QDialog
      dialog.show()
    },
    hide() {
      const dialog = this.$refs.dialog as QDialog
      dialog.hide()
    },
    onDialogHide() {
      this.$emit("hide")
    },
    onOKClick() {
      this.$emit("ok")
      this.hide()
    },
  },
})
</script>
