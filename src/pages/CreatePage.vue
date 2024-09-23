<template lang="pug">
q-page.full-height.full-width
  //- .centered.q-mt-md
  //-   h2 Create
  .centered.q-ma-md
    .col-auto
      CreateCard(@created="addImage" style="padding-top:18px; min-width:300px; max-width:600px;" ref="createCard")
    .col-auto(style="height:90vh")
      q-scroll-area(style="width:1090px; height:100%; max-width:90vw;")
        .q-ma-md
          div(style="max-width:100%")
            q-card(v-for="(creation, index) in createSession.sessionItems" style="overflow:scroll" :key="creation.id").full-width.q-pa-lg.q-mb-md
              div {{ creation.request }}
              div {{ creation.imageIds }}
              .row.q-mb-md.q-gutter-md(style="overflow:scroll; max-width:1000px;")
                .col-auto
                  q-btn(size="sm" icon="arrow_back" flat round @click="setReq(creation.request)")
                .col-10
                  p.ellipsis {{  creation.request.prompt }}
              .row.full-width.q-gutter-lg
                CreatedImageCard(v-for="imageId in creation.imageIds" :imageId="imageId" style="width:300px; height:auto;" :key="imageId")


</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "stores/userAuth"
import CreateCard from "components/CreateCard.vue"
import CreatedImageCard from "components/CreatedImageCard.vue"
import { useCreateSession } from "stores/createSessionStore"
import { CreateImageRequest } from "fiddl-server/dist/lib/types/serverTypes"
import { toObject } from "lib/util"
export default defineComponent({
  components: {
    CreateCard,
    CreatedImageCard,
  },
  data() {
    return {
      userAuth: useUserAuth(),
      createSession: useCreateSession(),
      images: [] as string[],
    }
  },
  watch: {
    "userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      },
    },
  },
  mounted() {},
  methods: {
    setReq(request: CreateImageRequest) {
      const createCard = this.$refs.createCard as InstanceType<typeof CreateCard>
      createCard.req = toObject(request)
    },
    async addImage(data: string) {
      // this.createSession.generateImage({ prompt: data })
      // console.log('add image', data)
      // const blobUrl = await api.image.load(data)
      // this.images = [blobUrl, ...this.images]
    },
  },
})
</script>
