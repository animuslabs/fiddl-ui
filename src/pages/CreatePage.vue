<template lang="pug">
q-page.full-width
  div(v-if="$userAuth.loggedIn").full-width
    PromptTab(:id="1" ref="promptTab")
  div(v-else)
    .centered.q-mt-xl
      h3 You must be logged in to create images
    .centered
      q-btn(label="Login" color="primary" @click="$router.push({name:'login'})" flat)

</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useQuasar } from "quasar"
import PromptTab from "src/components/PromptTab.vue"
import { useCreateImageStore } from "src/stores/createImageStore"
import { CreateImageRequest, CreateVideoRequest } from "../../../fiddl-server/dist/lib/types/serverTypes"
import { useCreateOrchestrator } from "src/lib/composables/useCreateOrchestrator"

export default defineComponent({
  components: {
    PromptTab,
  },
  setup() {
    const quasar = useQuasar()
    useCreateOrchestrator()
    return { quasar }
  },
  data() {
    return {
      createStore: useCreateImageStore(),
      images: [] as string[],
      createMode: false,
    }
  },
  watch: {},
  methods: {
    setReq(request: Partial<CreateImageRequest | CreateVideoRequest>, toggleCreateMode = false) {
      console.log("setReq", toggleCreateMode)
      const promptTab = this.$refs.promptTab as InstanceType<typeof PromptTab>
      if (toggleCreateMode) {
        if (promptTab) promptTab.createMode = true
        this.createMode = true
      }
      promptTab.setReq(request)
      // this.createStore.setReq({ ...request })
    },
    addImage(data: string) {
      console.log("add Image triggered")
      if (this.createMode) this.createMode = false
    },
  },
})
</script>
