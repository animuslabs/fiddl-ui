<template lang="pug">
div
  .centered
    q-uploader( :multiple="false" :url="apiUrl+'/upload'" style="max-width: 300px;"  auto-upload flat @uploaded="done" :headers="headers").relative-position.drop-area
  .centered
    h5 Drop or select an audio file to get started.

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { apiUrl } from "src/lib/api"
import { jwt } from "lib/jwt"
export default defineComponent({
  // name: 'ComponentName'
  data() {
    return {
      apiUrl,
      input: ""
    }
  },
  emits: {
    uploaded: (val:string):string => val
  },
  computed: {
    headers() {
      return [
        { name: "Authorization", value: `Bearer ${jwt.read()?.token}` }
      ]
    }
  },
  methods: {
    done(val:any) {
      console.log(val)
      val.files.forEach((file:any) => {
        const response = JSON.parse(file.xhr.responseText)
        console.log(response) // This is your server response
        this.$emit("uploaded", response.id)
      })
    },
    handleDrop(event:DragEvent) {
      if (!event.dataTransfer) return
      event.preventDefault()
      console.log(event.dataTransfer.files)
    },
    submit() {
      console.log(this.input)
    }
  }
})
</script>

<style>
  .drop-area {
      border: 2px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      margin: 20px;
  }
  .drop-area.hover {
      background-color: #f0f0f0;
  }
</style>
