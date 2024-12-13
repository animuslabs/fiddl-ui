<template lang="pug">
div.parallax.full-width(style="min-height: 100vh; position: relative; background-position: center 53px;" )
  .full-width(style="height:50px;")
  div
    .centered.q-pt-xl.fadeIn
      q-img.q-ma-md.relative-position(src="/fiddlLogoWithText-hor.svg" fit="contain" style="width: 600px; max-width: 80vw; opacity:0.9;" alt="fiddl logo")
        .gt-xs.absolute(style="bottom:-10px; left:200px; background-color: transparent; text-wrap: nowrap; overflow: visible;")
          h3 Create and Earn with AI Art
        .lt-sm.absolute(style="bottom:-20px; left:30%; background-color: transparent; width:100%;")
          h6 Create and Earn with AI Art
    .centered.q-mt-lg.fadeIn
      q-btn(size="lg" label="Get Started" color="primary" to="/create" rounded)
    .centered()
      .row.q-mt-lg.q-gutter-md.q-pa-md(style="max-width: 600px;")
        .col(style="min-width: 200px;" v-for="infoCard in infoCards")
          InfoCard(v-bind="infoCard")

    .centered.q-mt-lg
      q-btn(size="lg" label="Join the email list" color="accent" @click="showMailForm = true" rounded icon="email" v-scroll-fire="onscroll")
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
@keyframes fadeIn {
  from {
    opacity: 0;
    filter: blur(10px); // Start with more blur
  }
  to {
    opacity: 1;
    filter: blur(0); // End with no blur
  }
}
.fadeIn {
  opacity: 0;
  animation: fadeIn 1s 0.3s forwards;
  animation-fill-mode: forwards;
}
.fadeInFast {
  opacity: 0;
  animation: fadeIn 0.3s 0s forwards;
  animation-fill-mode: forwards;
}
.parallax {
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  background-image: url("/homeBg-lg.webp");
}
@media (max-width: 768px) {
  // Adjust breakpoint as necessary
  .parallax {
    background-image: url("/homeBg-sm.webp"); // Smaller, optimized image for mobile
  }
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
      moved: false,
      topButtons,
      showMailForm: false,
      infoCards,
    }
  },
  watch: {},
  methods: {
    onscroll() {
      this.moved = true
    },
  },
})
</script>
