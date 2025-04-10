<template lang="pug">
q-card.q-pa-md.blurbg.full-height.fadeIn(style="min-height:200px;")
  .centered
    .row.q-gutter-md.items-center
      q-icon(:name="icon" size="50px" color="primary")
      h4 {{title}}
  .q-mt-lg
  q-separator(color="grey" spaced inset)
  div.q-ma-md
    p {{description}}
  .centered.q-mt-lg
    .centered
      .col-grow
      //- q-btn(:label="hrefLabel" rounded color="primary"  type="a" v-if="href" :href="href"  icon="question_mark" outline size="md")
    //- h5.q-mt-sm(v-if="href") Learn about #[a(href="href") {{hrefLabel}}]

</template>
<style lang="scss">
.blurbg {
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(15px);
}
.flex-end {
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* Aligns children to the bottom */
  // height: 100%; /* Ensure it has a height for flexbox to work effectively */
  flex-grow: 1; /* Allows the div to grow and fill available space */
}
</style>
<script setup lang="ts">
import { defineComponent, defineProps } from "vue"
const props = defineProps<{
  title: string
  description: string
  icon: string
  href?: string
  hrefLabel?: string
}>()
</script>
