<template lang="pug">
q-page.full-height.full-width
  .centered.q-mt-md
    h2 Account Settings
  .centered.q-gutter-md.q-mt-md
    q-card(v-if="$userAuth.loggedIn")
      q-card-section
        h3 Profile
        h6 Username
        .row.q-gutter-md.items-center(v-if="!editingUsername")
          .col-auto
            h5 {{ $userAuth.userProfile?.username || "no username" }}
          .col-auto
            div
              q-btn(@click="editingUsername = true" round flat icon="edit" size="sm" )
          .col-grow
          .col-auto
            div
              q-btn(v-if="$userAuth.userProfile?.username" label="Get Referral Link" @click="copyRefLink()")
              div(v-else) Set a username to get a referral link

        .row.q-gutter-md.items-center(v-else)
          .col-auto
            q-input.q-pb-md( prefix="@" v-model="newUsername" label="Username" :rules="[validateUsername]" clearable)
          .col-auto
            div
              q-btn(@click="editingUsername = false" round flat icon="close" color="negative")
              q-btn(@click="setNewUsername()" round flat icon="check" color="positive")
        div(style="max-width: 400px;").q-mt-md
          p You will earn a 10% Fiddl Points bonus when users who register using your referral link purchase Fiddl Points.
        h6.q-pt-md Email
        .row.items-center
          div
            h5 {{ $userAuth.userProfile?.email?.toLowerCase() || "no email" }}
          div.q-ml-md
            q-icon(v-if="$userAuth.userProfile?.emailVerified" name="check" color="positive" size="sm")
            q-icon(v-else name="close" color="negative" size="sm")
          .q-ma-md(v-if="!$userAuth.userProfile?.emailVerified")
            q-btn( @click="verifyEmail()" label="Verify Email" flat color="positive" icon="email" size="md")
        .centered(v-if="!$userAuth.userProfile?.emailVerified")
          small.text-positive Earn 100 Points when you verify your email
        h6.q-pt-md Notifications
        .row(v-if="$userAuth.notificationConfig")
          //- pre {{ $userAuth.notificationConfig }}
          .row.items-center.q-gutter-md
            q-toggle(v-model="$userAuth.notificationConfig.email" label="Email Notifications" @click="updateNotificationConfig()")
            q-select(@popup-hide="updateNotificationConfig()" v-model="$userAuth.notificationConfig.emailFrequency" label="Email Frequency" :options="['instant', 'daily', 'weekly','monthly']" :disable="$userAuth.notificationConfig.email == false" style="width: 140px; text-transform: capitalize;")
    .centered.q-mt-md(v-else)
      h4 Please login to view your account
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useUserAuth } from "src/stores/userAuth"
import PointsTransfer from "src/components/PointsTransfer.vue"
import { copyToClipboard, Dialog, Loading, Notify } from "quasar"
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
    updateNotificationConfig() {
      if (!this.$userAuth.notificationConfig) return
      this.$api.user.setNotificationConfig.mutate(this.$userAuth.notificationConfig as any).catch(catchErr)
    },
    copyRefLink() {
      const refLink = window.location.origin + "/?referredBy=" + this.$userAuth.userProfile?.username
      void copyToClipboard(refLink)
      Notify.create({ message: "Referral link copied to clipboard", color: "positive", icon: "check" })
    },
    setNewUsername() {
      this.$api.user.setUsername
        .mutate(this.newUsername)
        .then(() => {
          this.editingUsername = false
          void this.$userAuth.loadUserProfile()
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
      void this.$userAuth.loadUserData()
      void this.$userAuth.loadUserProfile()
      void this.$userAuth.loadPointsHistory()
      void this.$userAuth.loadNotificationConfig()
    },
  },
})
</script>
