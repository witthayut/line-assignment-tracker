<script setup lang="ts">
import { computed, ref } from 'vue';
import AssignmentCard from '../components/AssignmentCard.vue';
import { daysLeft } from '../lib/format';
import { store } from '../lib/store';
import type { Assignment } from '../lib/types';

const showDone = ref(false);

const groups = computed(() => {
  const buckets: { key: string; label: string; tone: string; items: Assignment[] }[] = [
    { key: 'overdue', label: 'Overdue', tone: 'text-red-600', items: [] },
    { key: 'today', label: 'Today', tone: 'text-red-600', items: [] },
    { key: 'tomorrow', label: 'Tomorrow', tone: 'text-amber-600', items: [] },
    { key: 'week', label: 'Next 7 days', tone: 'text-ink', items: [] },
    { key: 'later', label: 'Later', tone: 'text-ink', items: [] },
    { key: 'none', label: 'No due date', tone: 'text-muted', items: [] },
  ];
  const find = (k: string) => buckets.find((b) => b.key === k)!;
  for (const a of store.assignments) {
    if (!showDone.value && a.status === 'COMPLETE') continue;
    const d = daysLeft(a);
    if (d === null) find('none').items.push(a);
    else if (d < 0) find('overdue').items.push(a);
    else if (d === 0) find('today').items.push(a);
    else if (d === 1) find('tomorrow').items.push(a);
    else if (d <= 7) find('week').items.push(a);
    else find('later').items.push(a);
  }
  return buckets.filter((b) => b.items.length > 0);
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-5 flex items-center gap-3">
      <h1 class="mr-auto text-xl font-semibold tracking-tight">Upcoming</h1>
      <label class="flex items-center gap-2 text-sm text-muted">
        <input v-model="showDone" type="checkbox" class="rounded" />
        Show completed
      </label>
    </div>

    <p v-if="groups.length === 0" class="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center text-sm text-muted">
      All clear — nothing due.
    </p>

    <section v-for="g in groups" :key="g.key" class="mb-6">
      <h2 class="mb-2 px-1 text-sm font-semibold" :class="g.tone">
        {{ g.label }} <span class="font-normal text-muted">{{ g.items.length }}</span>
      </h2>
      <div class="space-y-2.5">
        <AssignmentCard v-for="a in g.items" :key="a.id" :a="a" />
      </div>
    </section>
  </div>
</template>
