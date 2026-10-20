<script setup lang="ts">
import { computed } from 'vue';
import { STATUS_LABEL, STATUSES, TYPE_LABEL, TYPES, daysBetween } from '../lib/format';
import type { AssignmentInput, Course } from '../lib/types';

const props = defineProps<{
  courses: Pick<Course, 'id' | 'code' | 'name' | 'color'>[];
  showStatus?: boolean;
  /** Course the AI saw that isn't in the list yet (drafts only) */
  suggestedCourse?: string | null;
}>();
const form = defineModel<AssignmentInput>({ required: true });

const dateError = computed(() =>
  form.value.dueDate && form.value.startDate && daysBetween(form.value.startDate, form.value.dueDate) < 0
    ? 'Due date is before the start date'
    : '',
);
defineExpose({ dateError });

const selectedColor = computed(() => props.courses.find((c) => c.id === form.value.courseId)?.color ?? '#d6d3cb');
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="label" for="f-title">Title</label>
      <input id="f-title" v-model="form.title" class="field text-base font-medium" maxlength="200" placeholder="e.g. Lab 3 — REST API" />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="f-course">Course</label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" :style="{ background: selectedColor }" />
          <select id="f-course" v-model="form.courseId" class="field pl-8">
            <option :value="null">{{ suggestedCourse ? `New: ${suggestedCourse}` : 'No course' }}</option>
            <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.code ? `${c.code} · ${c.name}` : c.name }}</option>
          </select>
        </div>
        <p v-if="suggestedCourse && !form.courseId" class="mt-1 text-xs text-muted">This course will be added when you save.</p>
      </div>

      <div>
        <span class="label">Type</span>
        <div class="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
          <button
            v-for="t in TYPES"
            :key="t"
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium transition"
            :class="form.type === t ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
            @click="form.type = t"
          >
            {{ TYPE_LABEL[t] }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div>
        <label class="label" for="f-start">Start</label>
        <input id="f-start" v-model="form.startDate" type="date" class="field" required />
      </div>
      <div>
        <label class="label" for="f-due">Due date</label>
        <input id="f-due" :value="form.dueDate ?? ''" type="date" class="field" @input="form.dueDate = ($event.target as HTMLInputElement).value || null" />
      </div>
      <div class="col-span-2 sm:col-span-1">
        <label class="label" for="f-time">Due time</label>
        <input
          id="f-time"
          :value="form.dueTime ?? ''"
          type="time"
          class="field"
          :disabled="!form.dueDate"
          @input="form.dueTime = ($event.target as HTMLInputElement).value || null"
        />
        <p class="mt-1 text-xs text-muted">Empty = end of day</p>
      </div>
    </div>
    <p v-if="dateError" class="text-sm text-red-600">{{ dateError }}</p>

    <div v-if="showStatus">
      <span class="label">Status</span>
      <div class="flex gap-1 rounded-lg bg-stone-100 p-1">
        <button
          v-for="s in STATUSES"
          :key="s"
          type="button"
          class="flex-1 rounded-md px-2 py-1 text-xs font-medium transition"
          :class="form.status === s ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
          @click="form.status = s"
        >
          {{ STATUS_LABEL[s] }}
        </button>
      </div>
    </div>

    <div>
      <label class="label" for="f-details">Details</label>
      <textarea id="f-details" v-model="form.details" rows="7" class="field leading-relaxed" placeholder="Instructions, requirements, links…" />
    </div>
  </div>
</template>
