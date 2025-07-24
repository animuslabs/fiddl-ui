<template lang="pug">
q-card
  .row
    h4 {{ model.title }}
  .row
    p {{ model.summary }}
</template>

<script setup lang="ts">
import { reactive } from 'vue';


const model = reactive({
  name:
})
</script>
