<template lang="pug">
q-card.q-pa-md
  q-uploader.q-mb-md.relative-position(
    ref="uploader"
    accept="image/*"
    multiple
    auto-expand
    @added="handleFilesAdded"
    @removed="handleFileRemoved"
    :max-files="maxFiles"
    :max-file-size="maxFileSize"
    @rejected="handleRejected"
    label="Select or drag images here"
    color="grey-8"
    :style="uploaderStyle"
    class="hide-upload-button"
  )
  .absolute-center.full-width(style="top:120px;" @click="pickFiles").cursor-pointer
    .centered.text-white.q-pa-md(style="z-index: 10; opacity: 0.9; border-radius: 8px;" v-if="showDragMsg")
      p.q-ma-md Drag and drop images here, or use the button below

  .centered.full-width
    .col-auto.q-mr-md
      q-btn( outline  color="primary" label="Select Files" icon="add" @click="pickFiles" )
    .col-auto
      q-btn(color="primary" label="Upload All" icon="cloud_upload" @click="uploadFiles" :disable="!previewFiles.length")

</template>

<script lang="ts">
import { QRejectedEntry, QUploader } from "quasar"
import { defineComponent, ref } from "vue"

export default defineComponent({
  name: "ImageUploader",
  props: {
    maxFiles: {
      type: Number,
      default: 20,
    },
    maxFileSize: {
      type: Number,
      default: 10 * 1024 * 1024, // 10MB
    },
  },
  emits: {
    formData: (data: FormData) => true,
  },
  data() {
    return {
      previewFiles: [] as { file: File; src: string }[],
    }
  },
  computed: {
    showDragMsg() {
      return !this.previewFiles.length
    },
    uploaderStyle() {
      if (this.previewFiles.length) return "height:80vh; max-width:500px; border-radius: 16px; background-color: white"
      else return "min-height:200px; max-width:400px; border-radius: 16px"
    },
  },
  methods: {
    pickFiles(event: Event) {
      const uploader = this.$refs.uploader as QUploader
      uploader.pickFiles(event)
    },
    handleFilesAdded(files: readonly any[]) {
      files.forEach((file) => {
        console.log(file)
        if (file instanceof File && file.type.startsWith("image/")) {
          const reader = new FileReader()
          reader.onload = () => {
            console.log("loaded")
            this.previewFiles.push({ file, src: reader.result as string })
            console.log(this.previewFiles)
          }
          reader.readAsDataURL(file)
        } else {
          console.error("File is not an image")
          console.log(file)
        }
      })
    },
    handleFileRemoved(files: readonly any[]) {
      this.previewFiles = this.previewFiles.filter((f) => !files.includes(f.file))
    },
    handleRejected(rejectedEntries: QRejectedEntry[]) {
      rejectedEntries.forEach((entry) => {
        const message = entry.file.size > this.maxFileSize ? `File ${entry.file.name} exceeds the size limit` : `File ${entry.file.name} is not a supported image`

        this.$q.notify({
          color: "negative",
          message,
        })
      })
    },
    uploadFiles() {
      try {
        const imageData = new FormData()
        this.previewFiles.forEach(({ file }, i) => {
          imageData.append("image", file)
        })
        this.$emit("formData", imageData)
      } catch (error) {
        console.error("Error during upload:", error)
        this.$q.notify({ color: "negative", message: "Upload failed. Please try again." })
      }
    },
  },
})
</script>

<style lang="css">
/* Hide the default upload button */
.hide-upload-button .q-uploader__header {
  display: none;
}
</style>
