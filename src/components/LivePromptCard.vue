<template lang="pug">
q-card.q-pa-md.relative-position
  div(style="width:75%; height:100%; position:absolute; top:0%; left:0%;" v-if="!showAll && !lockHidden" @click="showAll = true").cursor-pointer
    q-tooltip
      p Maximize
  .row.justify-end.items-start.z-top
    //- .col
      //- p.text-weight-light.text-grey-7 Prompt {{ index + 1 }}
    .col(v-if="!loading || localPrompt.promptText!=''")
      p.q-ma-sm {{ localPrompt.promptText }}
    .col(v-else)
      q-skeleton(type="text" animation="wave")
    q-btn.icon.rounded.outline(v-if="!lockHidden" flat round @click="toggleCard" :icon="showAll ? 'sym_o_expand_less' : 'sym_o_expand_more'" size="sm" :disable="loading" color="grey-7")
      q-tooltip
        p(v-if="showAll") Minimize
        p(v-else) Maximize
    q-btn.icon.rounded.outline(v-if="!lockHidden" flat round @click="refreshPrompt" icon="sym_o_refresh" size="sm" :disable="loading" color="grey-7")
      q-tooltip
        p Refresh Prompt
    q-btn.icon.rounded.outline(flat round @click="deletePrompt" icon="sym_o_delete" size="sm" :disable="loading" color="grey-7")
      q-tooltip
        p Delete Prompt
  //- p {{ localPrompt.promptText }}
  div(v-if="showAll")
    q-separator
    p.q-pa-md.text-black.bg-white.relative-position(v-if="!loading && localPrompt.promptResponse!='' && !localPrompt.processing") {{ localPrompt.promptResponse }}
      q-btn(style="right:0px; position: absolute;" flat round @click="copyToClipboard(localPrompt.promptResponse)" icon="sym_o_content_copy" size="sm" color="grey-7")
        q-tooltip
          p Copy Text
    p.q-pa-md.text-black.bg-white.relative-position(v-else)
      q-skeleton(type="text" animation="wave")
      q-skeleton(type="text" animation="wave")
      q-skeleton(type="text" animation="wave")
      q-skeleton(type="text" animation="wave")
    q-separator
    .centered.q-gutter-md
      .col
        small created: {{ new Date(localPrompt.createdAt).toLocaleString() }}

      .col-auto
        small updated: {{ new Date(localPrompt.updatedAt).toLocaleString() }}

  //- div {{ livePrompt.processing }}
</template>

<script lang="ts">
import { api } from "lib/api"
import { LivePrompt } from "lib/prisma"
import { Dialog, Notify, copyToClipboard } from "quasar"
import { PropType, defineComponent } from "vue"

export default defineComponent({
  data() {
    return {
      copyToClipboard,
      showAll: true,
      localPrompt: { ...this.livePrompt } as LivePrompt,
      loading: false
    }
  },
  mounted() {
    if (this.lockHidden) this.showAll = false
  },
  props: {
    index: {
      type: Number,
      required: true
    },
    livePrompt: {
      type: Object as PropType<LivePrompt>,
      required: true
    },
    showAllCards: {
      type: (Boolean || null) as PropType<boolean| null>,
      required: false,
      default: true
    },
    lockHidden: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  watch: {
    lockHidden(val:boolean) {
      if (val) this.showAll = false
    },
    livePrompt: {
      handler(newVal:LivePrompt) {
        if (!newVal) return
        if (newVal.processing) this.loading = true
        else this.loading = false
        if (!newVal.processing && newVal.promptResponse == "") this.showAll = false
        this.localPrompt = { ...newVal }
      },
      deep: true,
      immediate: true
    },
    "showAllCards"(val:boolean|null) {
      if (val != null) this.showAll = val
    },
    showAll(val:boolean) {
      if (val && this.localPrompt.promptResponse == "" && !this.localPrompt.processing) void this.refreshPrompt()
    }
  },
  emits: ["refreshPrompts"],
  methods: {
    async deletePrompt() {
      Dialog.create({
        title: "Delete Prompt #" + (this.index + 1),
        message: "Are you sure you want to delete this prompt?",
        ok: {
          label: "Delete",
          color: "negative"


        },
        cancel: {
          label: "Cancel",
          color: "primary",
          flat: true

        }
      }).onOk(async() => {
        console.log("deletePrompt", this.livePrompt.id)
        this.loading = true
        await api.livePrompts.delete(this.livePrompt.liveSessionId, this.livePrompt.id).catch(console.error)
        this.$emit("refreshPrompts")
        Notify.create({ message: "Prompt deleted", color: "negative" })
      })
    },
    async refreshPrompt() {
      this.loading = true
      console.log("refreshPrompt")
      if (!this.showAll) this.showAll = true
      const updated = await api.livePrompts.refresh(this.livePrompt.liveSessionId, this.livePrompt.id).catch(console.error)
      console.log(updated)
      if (updated) this.localPrompt = updated
      this.loading = false
    },
    toggleCard() {
      console.log("toggleCard")
      if (this.lockHidden) this.showAll = false
      else this.showAll = !this.showAll
    }
  }
})
</script>
