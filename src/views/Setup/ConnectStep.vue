<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/api'
import { verifyAccess } from '@/api/access'
import UiButton from '@/components/ui/UiButton.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import { accessErrors, loadAccess, safeNext, saveAccess, type Access } from '@/domain/access'

const route = useRoute()

// Only what this browser saved is offered back; runtime config and .env are never shown here.
const form = reactive<Access>(loadAccess())
const submitted = ref(false)
const busy = ref(false)
const serverError = ref('')

const errors = computed(() => (submitted.value ? accessErrors(form) : {}))

async function connect() {
  submitted.value = true
  serverError.value = ''
  if (Object.keys(accessErrors(form)).length > 0) return
  busy.value = true
  try {
    await verifyAccess(form)
    saveAccess(form)
    // A full load, so the API client and every store start from the saved details.
    window.location.assign(
      `${import.meta.env.BASE_URL.replace(/\/$/, '')}${safeNext(route.query.next)}`,
    )
  } catch (error) {
    serverError.value =
      error instanceof ApiError ? error.message : 'Could not connect. Try again in a moment.'
    busy.value = false
  }
}
</script>

<template>
  <main class="flex h-full items-center justify-center bg-black p-6">
    <form
      class="flex w-112 max-w-full flex-col gap-5 rounded-lg bg-dark-400 p-6"
      aria-labelledby="connect-title"
      novalidate
      @submit.prevent="connect"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex size-6 items-center justify-center rounded-sm bg-white text-xs font-bold text-dark-400"
          aria-hidden="true"
        >
          M
        </span>
        <span class="text-base font-bold text-white">MDoc</span>
      </div>

      <h1 id="connect-title" class="text-xl text-white">Connect to MDoc</h1>
      <p class="text-sm text-light-400">
        The organization scopes what you see. The API key grants access. Details stay in this
        browser.
      </p>

      <UiTextField
        v-model="form.organizationId"
        label="Organization ID"
        placeholder="modest-human-brands"
        :error="errors.organizationId"
      />
      <UiTextField
        v-model="form.userId"
        label="User ID"
        placeholder="Your user id"
        :error="errors.userId"
      />
      <UiTextField
        v-model="form.apiKey"
        label="API key"
        type="password"
        placeholder="••••••••••••"
        :error="errors.apiKey"
      />

      <p v-if="serverError" class="text-sm text-alert-400" role="alert">{{ serverError }}</p>

      <UiButton type="submit" :disabled="busy">{{ busy ? 'Connecting…' : 'Continue' }}</UiButton>
    </form>
  </main>
</template>