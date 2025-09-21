<template lang="pug">
MediaViewerDialog(
  :mediaObjects="mediaObjects"
  :requestId="requestId"
  :startIndex="startIndex"
  :allowDelete="allowDelete"
  :initialCommentId="initialCommentId"
  @ok="onOKClick"
  @hide="onDialogHide"
  ref="dialogRef"
)
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import type { MediaGalleryMeta } from "src/components/MediaGallery.vue"
import MediaViewerDialog from "./MediaViewerDialog.vue"

export default defineComponent({
  components: {
    MediaViewerDialog,
  },
  props: {
    mediaObjects: {
      type: Array as () => MediaGalleryMeta[],
      required: true,
    },
    requestId: {
      type: String,
      default: "",
      required: false,
    },
    startIndex: {
      type: Number,
      default: 0,
      required: false,
    },
    allowDelete: {
      type: Boolean,
      default: true,
    },
    initialCommentId: {
      type: String,
      default: null,
      required: false,
    },
  },
  emits: ["ok", "hide"],
  setup(props, { emit }) {
    const dialogRef = ref<InstanceType<typeof MediaViewerDialog> | null>(null)

    function show() {
      dialogRef.value?.show()
    }

    function hide() {
      dialogRef.value?.hide()
    }

    function onDialogHide() {
      emit("hide")
    }

    function onOKClick() {
      emit("ok")
      hide()
    }

    return {
      dialogRef,
      show,
      hide,
      onDialogHide,
      onOKClick,
    }
  },
})
</script>
