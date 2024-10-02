<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 My Account
  .centered.q-gutter-md.q-mt-md
    q-card(v-if="userAuth.loggedIn")
      q-card-section
        h3 Profile
        h6 Username
        .row.q-gutter-md.items-center(v-if="!editingUsername")
          .col-auto
            h5 {{ userAuth.userProfile?.username || "no username" }}
          .col-auto
            div
              q-btn(@click="editingUsername = true" round flat icon="edit" size="sm" )
        .row.q-gutter-md.items-center(v-else)
          .col-auto
            q-input.q-pb-md( prefix="@" v-model="newUsername" label="Username" :rules="[validateUsername]" clearable)
          .col-auto
            div
              q-btn(@click="editingUsername = false" round flat icon="close" color="negative")
              q-btn(@click="setNewUsername()" round flat icon="check" color="positive")
        h6.q-pt-md Email
        .row.items-center
          h5 {{ userAuth.userProfile?.email || "no email" }}
          .q-ma-md
            q-icon(v-if="userAuth.userProfile?.emailVerified" name="check" color="positive")
            q-icon(v-else name="close" color="negative")
          .q-ma-md(v-if="!userAuth.userProfile?.emailVerified")
            q-btn( @click="verifyEmail()" label="Verify Email" flat color="positive" icon="email" size="md")
        .centered(v-if="!userAuth.userProfile?.emailVerified")
          small.text-positive Earn 100 Points when you verify your email

      q-card.q-ma-md
        h6 Fiddl Points
        .row
          .col-auto
            .row.q-gutter-md.items-center
              .col
                q-img(src="/fiddlPointsLogo-sm.svg" style="width:50px;")
              .col-auto
                .centered
                  h5 {{ $userAuth.userData?.availablePoints || 0 }}
                .centered
                  h6 Available
              .col-auto
                .centered
                  h5 {{ $userAuth.userData?.spentPoints || 0 }}
                .centered
                  h6 Spent
        q-separator.q-mt-md(color="primary")
        q-list
          PointsTransfer.q-pt-md(v-for="transfer of userAuth.pointsHistory" :transferData="transfer" :key="transfer.id")
          .centered(v-if="userAuth.pointsHistory.length == 0")
            h6.q-mt-md No points history
    .centered.q-mt-md(v-else)
      h4 Please login to view your account
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "src/stores/userAuth"
import PointsTransfer from "src/components/PointsTransfer.vue"
import { Dialog, Loading, Notify } from "quasar"
import { catchErr } from "lib/util"

function validateUsername(username: string): string | true {
  // This regex allows letters, numbers, underscores, hyphens, and emojis, but no spaces
  const usernameRegex = /^[\w\p{Emoji}-]{2,15}$/u

  if (!username) {
    return "Username is required."
  }
  if (username.length < 2) {
    return "Username must be at least 2 characters."
  }
  if (username.length > 15) {
    return "Username must not exceed 15 characters."
  }
  if (!usernameRegex.test(username)) {
    return "Username can only contain letters, numbers, underscores, hyphens, and emojis."
  }

  return true
}

export default defineComponent({
  components: { PointsTransfer },
  data() {
    return {
      userAuth: useUserAuth(),
      editingUsername: false,
      newUsername: "",
      validateUsername,
    }
  },
  watch: {
    "userAuth.loggedIn": {
      immediate: true,
      handler() {
        // reload any user specific stuff here
      },
    },
  },
  mounted() {
    this.loadData()
  },
  methods: {
    setNewUsername() {
      this.$api.user.setUsername
        .mutate(this.newUsername)
        .then(() => {
          this.editingUsername = false
          void this.userAuth.loadUserProfile()
          Notify.create({ message: "Username updated", color: "positive", icon: "check" })
        })
        .catch((err: any) => {
          console.error(err)
          Dialog.create({ title: "Error Updating Username", message: err.message, color: "negative" })
        })
    },
    async verifyEmail() {
      if (!this.$userAuth.userProfile?.email) return
      Loading.show({ message: "Sending verification email..." })
      await this.$api.user.sendVerificationEmail.mutate().catch(catchErr)
      Loading.hide()
      Dialog.create({
        message: "Verification email sent to " + this.$userAuth.userProfile?.email + " Click the link in the email to verify your account and earn 100 Fiddl Points.",
      })
    },
    loadData() {
      void this.userAuth.loadUserData()
      void this.userAuth.loadUserProfile()
      void this.userAuth.loadPointsHistory()
    },
  },
})
</script>
