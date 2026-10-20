<script setup lang="ts">
import { computed } from 'vue';
import { STATUS_LABEL, STATUSES, TYPE_LABEL, courseShort, daysLeft, dueText, relativeText, urgencyClass } from '../lib/format';
import { store, toast, updateAssignment } from '../lib/store';
import type { Assignment, Status } from '../lib/types';

const props = defineProps<{ a: Assignment }>();

const days = computed(() => daysLeft(props.a));
const done = computed(() => props.a.status === 'COMPLETE');

async function setStatus(status: Status) {
  try {
    await updateAssignment(props.a.id, { status });
  } catch {
    toast('Could not update status');
  }
}
</script>

<template>
  <article
    class="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-white p-3.5 pl-4 transition hover:-translate-y-px hover:shadow-md"
    :class="{ 'opacity-60': done }"
    @click="store.editing = a.id"
  >
    <span class="absolute inset-y-0 left-0 w-1" :style="{ background: a.course?.color ?? '#d6d3cb' }" />

    <div class="flex items-center gap-2 text-xs">
      <span class="font-semibold" :style="{ color: a.course?.color ?? '#6b7280' }">{{ courseShort(a) }}</span>
      <span class="text-muted">·</span>
      <span class="text-muted">{{ TYPE_LABEL[a.type] }}</span>
    </div>

    <h3 class="mt-1 font-medium leading-snug" :class="{ 'line-through': done }">{{ a.title }}</h3>

    <div class="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted">{{ dueText(a) }}</span>
      <span v-if="days !== null || done" class="rounded-full px-2 py-0.5 font-medium" :class="urgencyClass(days, a.status)">
        {{ done ? 'Done' : relativeText(days) }}
      </span>
      <select
        class="ml-auto rounded-md border border-transparent bg-transparent py-0.5 text-xs text-muted hover:border-line focus:border-line"
        :value="a.status"
        aria-label="Status"
        @click.stop
        @change="setStatus(($event.target as HTMLSelectElement).value as Status)"
      >
        <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
      </select>
    </div>
  </article>
</template>
