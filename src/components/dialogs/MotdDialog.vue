<template lang="pug">
q-dialog(v-model="isOpen" transition-show="scale" transition-hide="scale" @hide="onHide" :maximized="isXs")
  q-card(:class="cardClass" flat bordered)
    q-card-section
      .row.items-start.no-wrap.q-col-gutter-md
        q-icon(name="campaign" size="36px" color="primary" class="q-mt-xs")
        .column.q-gutter-xs(style="min-width:0")
          .text-h6.text-weight-bold.motd-title {{ message?.title || 'Message of the Day' }}
          .text-caption.text-grey-5.text-uppercase(v-if="message") {{ formattedDay }}
          .text-body2.text-grey-4(v-if="message?.subheading") {{ message.subheading }}
    q-separator
    q-card-section(:class="bodyClass")
      div.motd-markdown(v-html="bodyHtml")
    q-separator
    q-card-actions(align="right" class="motd-card-actions")
      q-btn(flat icon="close" color="primary" label="Close" @click="onClose")
</template>

<script lang="ts" setup>
import { computed } from "vue"
import { useQuasar } from "quasar"
import { useMotdStore } from "stores/motdStore"
import { renderMarkdown } from "lib/markdown"

const $q = useQuasar()
const store = useMotdStore()

const message = computed(() => store.latest)

const bodyHtml = computed(() => renderMarkdown(message.value?.body))

const formattedDay = computed(() => {
  if (!message.value?.startsAt) return ""
  try {
    const date = new Date(message.value.startsAt)
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return ""
  }
})

const isXs = computed(() => $q.screen.lt.md)
const cardClass = computed(() => ({
  "motd-dialog-card": true,
  "motd-dialog-card--xs": isXs.value,
}))
const bodyClass = computed(() => ({
  "motd-body": true,
  "motd-body--xs": isXs.value,
}))

const isOpen = computed({
  get: () => store.dialogVisible && Boolean(store.latest),
  set: (val: boolean) => {
    if (!val) store.closeDialog()
    else store.showDialog()
  },
})

function onHide() {
  store.closeDialog()
}

function onClose() {
  store.closeDialog()
}
</script>

<style lang="sass" scoped>
.motd-dialog-card
  width: min(720px, 92vw)
  display: flex
  flex-direction: column

.motd-title
  font-size: clamp(22px, 3.2vw, 28px)
  line-height: 1.2

.motd-dialog-card--xs
  width: 100%
  height: 100%
  max-width: 100%
  max-height: 100%
  border-radius: 0
  flex: 1

.motd-markdown
  color: #eceff1
  font-size: 16px
  line-height: 1.5
  word-break: break-word
  :deep(a)
    color: #82e9de
    text-decoration: none
    &:hover
      text-decoration: underline
  :deep(img)
    display: block
    width: auto
    height: auto
    max-width: 100%
    max-height: 500px
    object-fit: contain
    border-radius: 6px
    margin: 12px auto
  :deep(h1)
    font-size: 26px
    line-height: 1.3
  :deep(h2)
    font-size: 22px
    line-height: 1.3
  :deep(h3)
    font-size: 18px
    line-height: 1.3
  :deep(h4), :deep(h5), :deep(h6)
    font-size: 17px
    line-height: 1.3
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6)
    margin-top: 20px
    margin-bottom: 10px
  :deep(pre)
    background: rgba(255,255,255,0.05)
    padding: 12px
    border-radius: 6px
    overflow: auto
    font-family: var(--q-code-font-family)
  :deep(code)
    background: rgba(255,255,255,0.08)
    padding: 2px 4px
    border-radius: 4px

.motd-body
  max-height: 55vh
  overflow: auto

.motd-body--xs
  flex: 1
  max-height: none
  overflow: auto

.motd-card-actions
  margin-top: auto
</style>
