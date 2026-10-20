<script setup lang="ts">
// Opened from the "Edit" button on the LINE confirm card.
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AssignmentForm from '../components/AssignmentForm.vue';
import { api, ApiError } from '../lib/api';
import { closeLiff, inLineApp } from '../lib/auth';
import { daysBetween, toInput } from '../lib/format';
import type { Assignment, AssignmentInput, Course } from '../lib/types';

const route = useRoute();
const id = route.params.id as string;

const draft = ref<Assignment | null>(null);
const courses = ref<Course[]>([]);
const form = ref<AssignmentInput | null>(null);
const phase = ref<'loading' | 'edit' | 'saved' | 'discarded' | 'error'>('loading');
const message = ref('');
const busy = ref(false);

const suggested = computed(() => {
  const d = draft.value;
  if (!d || d.courseId || !(d.suggestedCourseCode || d.suggestedCourseName)) return null;
  return [d.suggestedCourseCode, d.suggestedCourseName].filter(Boolean).join(' · ');
});

const invalid = computed(() => {
  const f = form.value;
  return !f || !f.title.trim() || !f.dueDate || Boolean(f.dueDate && daysBetween(f.startDate, f.dueDate) < 0);
});

onMounted(async () => {
  try {
    const [a, c] = await Promise.all([api<Assignment>(`/assignments/${id}`), api<Course[]>('/courses')]);
    draft.value = a;
    courses.value = c;
    form.value = toInput(a);
    phase.value = a.state === 'CONFIRMED' ? 'saved' : 'edit';
    if (a.state === 'CONFIRMED') message.value = 'This card is already saved.';
  } catch (err) {
    phase.value = 'error';
    message.value = err instanceof ApiError && err.status === 404 ? 'This card no longer exists.' : 'Could not load the card.';
  }
});

function finish() {
  if (inLineApp()) setTimeout(closeLiff, 1200);
}

async function saveAndConfirm() {
  if (!form.value || !draft.value) return;
  busy.value = true;
  try {
    const body: Partial<AssignmentInput> = { ...form.value };
    // Keep the AI's course suggestion so it gets created on confirm
    if (!body.courseId && suggested.value) delete body.courseId;
    await api(`/assignments/${id}/confirm`, { method: 'POST', body });
    phase.value = 'saved';
    message.value = 'Saved to your board ✓';
    finish();
  } catch (err) {
    message.value = err instanceof ApiError ? err.message : 'Could not save';
  } finally {
    busy.value = false;
  }
}

async function discard() {
  if (!confirm('Discard this card?')) return;
  busy.value = true;
  try {
    await api(`/assignments/${id}`, { method: 'DELETE' });
    phase.value = 'discarded';
    message.value = 'Discarded.';
    finish();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-xl bg-white px-5 pb-28 pt-5">
    <p class="text-xs font-medium uppercase tracking-wide text-muted">Check before saving</p>

    <div v-if="phase === 'loading'" class="py-20 text-center text-sm text-muted">Loading…</div>

    <div v-else-if="phase !== 'edit'" class="py-20 text-center">
      <p class="text-lg font-medium">{{ message }}</p>
      <div class="mt-6 flex justify-center gap-2">
        <a v-if="phase === 'saved'" :href="`/?open=${id}`" class="btn btn-ghost">Open on website</a>
        <button v-if="inLineApp()" class="btn btn-primary" @click="closeLiff">Close</button>
      </div>
    </div>

    <template v-else-if="form">
      <h1 class="mb-5 mt-1 text-xl font-semibold tracking-tight">Edit assignment</h1>
      <AssignmentForm v-model="form" :courses="courses" :suggested-course="suggested" />
      <p v-if="!form.dueDate" class="mt-3 text-sm text-red-600">A due date is needed before saving.</p>
      <p v-if="message" class="mt-3 text-sm text-red-600">{{ message }}</p>

      <div class="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div class="mx-auto flex max-w-xl gap-2">
          <button class="btn btn-danger" :disabled="busy" @click="discard">Discard</button>
          <button class="btn btn-primary ml-auto flex-1 py-2.5" :disabled="invalid || busy" @click="saveAndConfirm">
            {{ busy ? 'Saving…' : 'Save & confirm' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
