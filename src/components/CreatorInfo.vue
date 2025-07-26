<template lang="pug">
.row.items-center.cursor-pointer(
  @click="goToCreator()"
  v-if="creatorMeta.userName"
  :class="wrapperClass"
)
  q-img(
    placeholder-src="/blankAvatar.webp"
    :src="avatarImg(creatorMeta.id||'')"
    :style="avatarStyle"
  ).q-mr-sm
  .row
    div
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
</style>
