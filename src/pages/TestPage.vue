<template>
  <div>
    <h1>Test Page</h1>
    <p>{{ hello }}</p>
    <!-- <p>{{ dsfdsf }}</p> -->
  </div>
</template>

<script lang="ts">
export default {
  name: "TestPage",
  components: {},
  data() {
    return {
      hello: "Hello World",
    }
  },
  methods: {},
}
</script>
