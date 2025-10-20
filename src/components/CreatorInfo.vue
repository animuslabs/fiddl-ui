<template lang="pug">
.row.items-center.cursor-pointer.no-wrap(
  @click.stop="goToCreator()"
  v-if="creatorMeta.userName"
  :class="['creator-info-root', wrapperClass]"
)
  q-img(
    placeholder-src="/blankAvatar.webp"
    :src="avatarImg(creatorMeta.id||'')"
    :style="avatarStyle"
    no-transition
    no-spinner
  ).q-mr-sm
  .row.username-container.no-wrap
    div.username-text
      component.no-margin(:is="usernameTag" :class="usernameClass") @{{creatorMeta.userName}}
</template>

<script setup lang="ts">
import { computed } from "vue"
import { avatarImg } from "src/lib/netlifyImg"
import { useRouter } from "vue-router"

interface CreatorMeta {
  userName: string
  id: string
}

interface Props {
  creatorMeta: CreatorMeta
  avatarSize?: string
  usernameTag?: string
  usernameClass?: string
  wrapperClass?: string
  clickable?: boolean
  showAt?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatarSize: "30px",
  usernameTag: "h6",
  usernameClass: "",
  wrapperClass: "",
  clickable: true,
  showAt: true,
})

const emit = defineEmits<{
  click: [creatorMeta: CreatorMeta]
}>()

const router = useRouter()

const avatarStyle = computed(() => ({
  width: props.avatarSize,
  height: props.avatarSize,
  borderRadius: "50%",
}))

function goToCreator() {
  if (!props.clickable) return
  if (!props.creatorMeta.userName.length) return

  emit("click", props.creatorMeta)

  void router.push({
    name: "profile",
    params: { username: props.creatorMeta.userName },
  })
}
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.creator-info-root {
  min-width: 0;
}
.no-wrap {
  flex-wrap: nowrap;
}
.username-container {
  flex: 1 1 auto;
  min-width: 0;
  gap: 4px;
}
.username-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.username-text > * {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
