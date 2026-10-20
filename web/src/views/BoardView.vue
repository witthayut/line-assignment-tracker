<script setup lang="ts">
import { computed, ref } from 'vue';
import AssignmentCard from '../components/AssignmentCard.vue';
import { STATUS_LABEL, TYPE_LABEL, TYPES } from '../lib/format';
import { store } from '../lib/store';
import type { Assignment, Status } from '../lib/types';

const courseFilter = ref('');
const typeFilter = ref('');
const search = ref('');
const showAllDone = ref(false);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return store.assignments.filter(
    (a) =>
      (!courseFilter.value || (courseFilter.value === 'none' ? !a.courseId : a.courseId === courseFilter.value)) &&
      (!typeFilter.value || a.type === typeFilter.value) &&
      (!q || a.title.toLowerCase().includes(q) || a.details.toLowerCase().includes(q)),
  );
});

function column(status: Status): Assignment[] {
  const list = filtered.value.filter((a) => a.status === status);
  if (status !== 'COMPLETE') return list; // already sorted by due date (soonest first)
  const recentFirst = [...list].reverse();
  return showAllDone.value ? recentFirst : recentFirst.slice(0, 12);
}

const columns: { status: Status; dot: string }[] = [
  { status: 'NOT_STARTED', dot: 'bg-stone-400' },
  { status: 'IN_PROGRESS', dot: 'bg-blue-500' },
  { status: 'COMPLETE', dot: 'bg-emerald-500' },
];

const doneCount = computed(() => filtered.value.filter((a) => a.status === 'COMPLETE').length);
</script>

<template>
  <div>
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <h1 class="mr-auto text-xl font-semibold tracking-tight">Board</h1>
      <input v-model="search" class="field !w-40 sm:!w-52" placeholder="Search…" />
      <select v-model="courseFilter" class="field !w-auto">
        <option value="">All courses</option>
        <option v-for="c in store.courses" :key="c.id" :value="c.id">{{ c.code ?? c.name }}</option>
        <option value="none">No course</option>
      </select>
      <select v-model="typeFilter" class="field !w-auto">
        <option value="">All types</option>
        <option v-for="t in TYPES" :key="t" :value="t">{{ TYPE_LABEL[t] }}</option>
      </select>
    </div>

    <div v-if="store.assignments.length === 0" class="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <p class="font-medium">No cards yet</p>
      <p class="mt-1 text-sm text-muted">Send a Classroom post or screenshot to the LINE bot, or press New.</p>
    </div>

    <div v-else class="grid gap-5 md:grid-cols-3">
      <section v-for="col in columns" :key="col.status" class="min-w-0">
        <header class="mb-2.5 flex items-center gap-2 px-1 text-sm font-medium">
          <span class="h-2 w-2 rounded-full" :class="col.dot" />
          {{ STATUS_LABEL[col.status] }}
          <span class="text-muted">{{ col.status === 'COMPLETE' ? doneCount : column(col.status).length }}</span>
        </header>
        <div class="space-y-2.5">
          <AssignmentCard v-for="a in column(col.status)" :key="a.id" :a="a" />
          <p v-if="column(col.status).length === 0" class="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            Nothing here
          </p>
          <button
            v-if="col.status === 'COMPLETE' && doneCount > 12"
            class="w-full py-1 text-xs text-muted hover:text-ink"
            @click="showAllDone = !showAllDone"
          >
            {{ showAllDone ? 'Show recent only' : `Show all ${doneCount}` }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
