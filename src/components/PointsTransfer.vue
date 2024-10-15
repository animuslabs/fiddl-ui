<template lang="pug">
q-card
  .row.items-center
    .col-auto.q-ma-sm
      h5(:class="class") {{ isPositive?'+':'-' }} {{ Math.abs(transferData.quantity) }}
      .col-auto
        small {{ timeSince(new Date(transferData.createdAt)) }}
        q-tooltip
          p {{ new Date(transferData.createdAt).toString() }}
    .col.q-pl-md.q-ma-md
      .row.q-gutter-md.items-center
        .col-auto.gt-sm
          .row.q-gutter-md.no-wrap
        .col-auto
          small Final Balance: #[p {{ transferData.userFinalBalance }}]
        .col-auto
          small Type: #[p {{ transferData.type }}]
        .col-grow
        .col-auto
          div
            q-btn(@click="showDetails()" size="sm" icon="info" round flat)
</template>

<script lang="ts">
import { PointsTransfer } from "lib/api"
import { defineComponent, PropType } from "vue"
import { timeSince } from "lib/util"
import { Dialog } from "quasar"

export default defineComponent({
  props: {
    transferData: {
      type: Object as PropType<PointsTransfer>,
      required: true,
    },
  },
  data() {
    return {
      timeSince,
    }
  },
  computed: {
    class() {
      return this.isPositive ? "text-positive" : "text-negative"
    },
    isPositive() {
      return this.transferData.quantity > 0
    },
  },
  methods: {
    showDetails() {
      console.log("showing details")
      Dialog.create({
        title: "Points Transfer Details",
        message: `
          <p>Transfer ID: ${this.transferData.id}</p>
          <p>Transfer Type: ${this.transferData.type}</p>
          <p>Transfer Quantity: ${this.transferData.quantity}</p>
          <p>Transfer Date: ${new Date(this.transferData.createdAt).toString()}</p>
          <p>Final Balance: ${this.transferData.userFinalBalance}</p>
          <p>Details: ${this.transferData.memo}</p>
        `,
        html: true,
      })
    },
  },
})
</script>
