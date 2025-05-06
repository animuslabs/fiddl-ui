<template lang="pug">
div.column.items-center.q-gutter-md.q-pa-md
  h5.text-center Verification
  p.text-center(v-if="method === 'email'") Enter the code sent to your email: {{ value }}
  p.text-center(v-else) Enter the code sent to your phone: {{ value }}

  q-input(
    v-model="code"
    label="Verification Code"
    type="text"
    class="full-width"
    @keyup.enter="verifyCode"
    ref="codeInput"
    :rules="[val => !!val || 'Code is required']"
  )

  q-btn(
    label="Verify"
    color="primary"
    @click="verifyCode"
    :loading="loading"
    class="full-width"
  )

  div.q-mt-lg
    q-btn(label="Cancel" color="grey" @click="$emit('close')" flat)
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue"
import { verifyEmailCode, verifySmsCode } from "src/lib/privy"
import { useQuasar } from "quasar"
import { useRouter } from "vue-router"
import { useUserAuth } from "src/stores/userAuth"

export default defineComponent({
  props: {
    method: {
      type: String,
      required: true,
      validator: (val: string) => ["email", "sms"].includes(val),
    },
    value: {
      type: String,
      required: true,
    },
  },
  emits: ["close"],
  setup(props, { emit }) {
    const $q = useQuasar()
    const router = useRouter()
    const userAuth = useUserAuth()
    const code = ref("")
    const loading = ref(false)
    const codeInput = ref(null)

    onMounted(() => {
      if (codeInput.value) {
        // @ts-ignore - focus method exists on the q-input element
        codeInput.value.focus()
      }
    })

    const verifyCode = async () => {
      if (!code.value) {
        $q.notify({
          color: "negative",
          message: "Please enter the verification code",
        })
        return
      }

      loading.value = true
      try {
        let result
        if (props.method === "email") {
          result = await verifyEmailCode(props.value, code.value)
        } else {
          result = await verifySmsCode(props.value, code.value)
        }

        // Save the token to localStorage
        const token = localStorage.getItem("privy:token")

        $q.notify({
          color: "positive",
          message: "Successfully verified",
        })

        // Update authentication state in the userAuth store
        await userAuth.privyLogin(result.user.id, token || "")

        emit("close")

        // Redirect to account page
        router.push({ name: "account" })
      } catch (error) {
        $q.notify({
          color: "negative",
          message: "Failed to verify code",
        })
        console.error(error)
      } finally {
        loading.value = false
      }
    }

    return {
      code,
      loading,
      codeInput,
      verifyCode,
    }
  },
})
</script>
