<template lang="pug">
div
  q-card
    .q-pa-md
      .centered
        //- h4 Describe your vision
      q-form(@submit="createImage")
        .centered.q-pa-md
          q-input(v-model="description"  @keydown="handleKeydown"  color="primary" filled style="width:600px; max-width:80vw;" type="textarea" placeholder="Describe your vision" )
        .centered
          q-btn( type="submit" label="Create" color="primary" )
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useUserAuth } from 'stores/userAuth'
import { api } from 'lib/api'
import { useCreateSession } from 'stores/createSessionStore'
export default defineComponent({
  components: {

  },
  data() {
    return {
      userAuth: useUserAuth(),
      description: '' as string,
      createSession: useCreateSession(),
    }
  },
  emits: ['created'],
  mounted() {
  },
  methods: {
    handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.createImage()
      }
    },
    async createImage() {
      // console.log('create image')
      // const result = await api.create.image({
      //   prompt: this.description
      // })
      // console.log('created', result)
      await this.createSession.generateImage({ prompt: this.description, model: "ultra" })
      await this.userAuth.loadUserData()
      // this.$emit('created', result)
    }
  }
})
</script>
