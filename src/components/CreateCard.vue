<template lang="pug">
div
  q-card
    .q-pa-md
      .centered
        //- h4 Describe your vision
      q-form(@submit="createImage")
        .centered.q-pa-md
          q-input(v-model="description" color="primary" filled style="width:600px; max-width:70vw;" type="textarea" placeholder="Describe your vision" )
        .centered
          q-btn(type="submit" label="Create" color="primary" )
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import {useUserAuth} from 'stores/userAuth'
import {api} from 'lib/api'
export default defineComponent({
  components: {

  },
  data() {
    return {
      userAuth: useUserAuth(),
      description:'' as string
    }
  },
  emits: ['created'],
  mounted(){
  },
  methods: {
    async createImage(){
      console.log('create image')
      const result = await api.create.image({
        prompt: this.description
      })
      console.log('created', result)
      this.$emit('created', result)
    }
  },
  watch: {
    "userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      }
    }
  }
})
</script>
