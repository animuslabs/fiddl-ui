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
import { useCreateOrchestrator } from "src/lib/composables/useCreateOrchestrator"

export default defineComponent({
  components: { PromptTab },
  setup() {
    const quasar = useQuasar()
    useCreateOrchestrator()
    return { quasar }
  },
})
</script>
