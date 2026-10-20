<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { devLogin, loginWithLine, session } from '../lib/auth';

const route = useRoute();
const router = useRouter();
const busy = ref(false);

async function dev() {
  busy.value = true;
  try {
    await devLogin();
    router.replace((route.query.next as string) || '/');
  } catch (err) {
    session.error = (err as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="grid min-h-dvh place-items-center px-6">
    <div class="w-full max-w-sm text-center">
      <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lg">
        <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5l4 4 8-9" /></svg>
      </span>
      <h1 class="mt-5 text-2xl font-semibold tracking-tight">Reminder</h1>
      <p class="mt-1 text-sm text-muted">Assignments and deadlines from your LINE bot.</p>

      <button class="btn mt-8 w-full bg-line-green py-3 text-white hover:brightness-95" @click="loginWithLine">
        Log in with LINE
      </button>
      <button v-if="session.config.devLogin" class="btn btn-ghost mt-2 w-full" :disabled="busy" @click="dev">
        Dev login (local only)
      </button>

      <p v-if="session.error" class="mt-4 break-words rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">{{ session.error }}</p>
    </div>
  </div>
</template>
