import type { MediaType } from "lib/types"
import type { PropType } from "vue"

export const dialogProps = {
  type: {
    type: String as PropType<MediaType>,
    default: null,
    required: true,
  },
  userOwnsMedia: Boolean,
  currentMediaId: {
    type: String as PropType<string>,
    default: null,
    required: true,
  },
}
