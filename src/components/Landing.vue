<template lang="pug">
div.parallax(style="min-height: 100vh; position: relative; background-image: url('/homeBg.png'); background-position: center 53px;")
  div
    .centered.q-pt-xl
      q-img.q-ma-md.relative-position(src="/fiddlLogoWithText-hor.svg" fit="contain" style="width: 600px; max-width: 90vw;")
        .gt-xs.absolute(style="bottom:-10px; left:200px; background-color: transparent;")
          h3 Create and Earn with AI Art
        .lt-sm.absolute(style="bottom:-20px; left:100px; background-color: transparent; width:100%;")
          h6 Create and Earn with AI Art
    .centered.q-mt-lg
      q-btn(size="lg" label="Get Started" color="primary" to="/create" rounded)
    .centered
      .row.q-mt-lg.q-gutter-md.q-pa-md(style="max-width: 600px;")
        .col(style="min-width: 200px;" v-for="infoCard in infoCards")
          InfoCard(v-bind="infoCard")

    .centered.q-mt-lg
      q-btn(size="lg" label="Join the email list" color="accent" @click="showMailForm = true" rounded icon="email")
    .centered.q-mt-sm
      p Receive special offers and updates
  q-dialog(v-model="showMailForm" :maximized="$q.screen.lt.sm")
    q-card
      .centered
        iframe(src="https://cdn.forms-content-1.sg-form.com/3ee3dc6b-ac50-11ef-bf6d-86ce176a3cb7" style="width:600px; max-width:90vw; height:500px; max-height:90vh; border:none;")
      .centered.q-ma-md
        q-btn(label="Close" @click="showMailForm = false" color="accent" icon="close" rounded)
  .full-width(style="height:50px;")
</template>

<style lang="scss">
.parallax {
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}
/* // dark mode a */
a {
  color: $primary;
}
/* // dark mode a:hover */
a:hover {
  color: #f0f0f0;
}
/* // dark mode a:visited */
a:visited {
  color: $primary;
}
</style>

<script lang="ts">
import { defineComponent } from "vue"
import InfoCard from "./InfoCard.vue"

const topButtons = [
  {
    label: "Features",
    href: "#features",
  },
  {
    label: "Testimonials",
    href: "#testimonials",
  },
  {
    label: "Blog",
    href: "#blog",
  },
  {
    label: "FAQ",
    href: "#faq",
  },
  {
    label: "Pricing",
    href: "#pricing",
  },
  {
    label: "Contact",
    href: "#contact",
  },
]
// make info cards [Create, Explore,Earn,Customize]
const infoCards = [
  {
    title: "Create",
    description: "Create AI art with Fiddl's easy-to-use tools and the latest models.",
    icon: "sym_o_stylus_note",
    href: "/blog/intro",
    hrefLabel: "What is Fiddl.art",
  },
  {
    title: "Discover",
    description: "Search, filter, and collect AI art created by the Fiddl community",
    icon: "explore",
    href: "/blog/guides/imageModels",
    hrefLabel: "Image Models",
  },
  {
    title: "Earn",
    description: "Earn money by selling your creations on Fiddl.",
    icon: "paid",
    href: "/blog/guides/fiddlPoints",
    hrefLabel: "Fiddl Points",
  },
  {
    title: "Customize",
    description: "Put yourself inside the artwork by uploading your photos.",
    icon: "sym_o_instant_mix",
    href: "/blog/guides/faceForge",
    hrefLabel: "Face Forge",
  },
]

export default defineComponent({
  components: { InfoCard },
  data() {
    return {
      topButtons,
      showMailForm: false,
      infoCards,
    }
  },
  methods: {},
})
</script>
