<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AssignmentModal from './components/AssignmentModal.vue';
import { logout, session } from './lib/auth';
import { loadAll, store } from './lib/store';

const route = useRoute();
const router = useRouter();
const bare = computed(() => Boolean(route.meta.bare));

const tabs = [
  { to: '/', label: 'Board', icon: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z' },
  { to: '/calendar', label: 'Calendar', icon: 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4' },
  { to: '/upcoming', label: 'Upcoming', icon: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
  { to: '/courses', label: 'Courses', icon: 'M5 5h10a4 4 0 0 1 4 4v10H9a4 4 0 0 1-4-4zM5 15a4 4 0 0 1 4-4h10' },
];

// Load data once logged in
watch(
  () => [session.user, bare.value] as const,
  ([user, isBare]) => {
    if (user && !isBare && !store.loaded && !store.loading) loadAll().catch(() => undefined);
  },
  { immediate: true },
);

// "?open=<id>" (link from the LINE "Saved" message) opens that card
watch(
  () => route.query.open,
  (id) => {
    if (typeof id === 'string' && id) {
      store.editing = id;
      router.replace({ query: { ...route.query, open: undefined } });
    }
  },
  { immediate: true },
);

async function doLogout() {
  await logout();
  store.loaded = false;
  router.push('/login');
}
</script>

<template>
  <RouterView v-if="bare" />

  <div v-else class="min-h-dvh pb-20 sm:pb-0">
    <header class="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight">
          <span class="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5l4 4 8-9" /></svg>
          </span>
          Reminder
        </RouterLink>

        <nav class="hidden items-center gap-1 sm:flex">
          <RouterLink
            v-for="t in tabs"
            :key="t.to"
            :to="t.to"
            class="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            exact-active-class="!bg-white !text-ink shadow-sm"
          >
            {{ t.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <button class="btn btn-primary" @click="store.editing = 'new'">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span class="hidden sm:inline">New</span>
          </button>
          <button class="flex items-center gap-2 rounded-full p-0.5 pr-2 text-sm text-muted hover:bg-black/5" title="Log out" @click="doLogout">
            <img v-if="session.user?.pictureUrl" :src="session.user.pictureUrl" class="h-7 w-7 rounded-full" alt="" />
            <span v-else class="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
              {{ session.user?.displayName.slice(0, 1) }}
            </span>
            <span class="hidden md:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-5">
      <div v-if="!store.loaded" class="py-20 text-center text-sm text-muted">Loading…</div>
      <RouterView v-else />
    </main>

    <!-- Mobile tab bar -->
    <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <RouterLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
        exact-active-class="!text-brand"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="t.icon" /></svg>
        {{ t.label }}
      </RouterLink>
    </nav>

    <AssignmentModal v-if="store.editing" :id="store.editing" @close="store.editing = null" />

    <Transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0">
      <div
        v-if="store.toast"
        class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg transition sm:bottom-6"
      >
        {{ store.toast }}
      </div>
    </Transition>
  </div>
</template>
