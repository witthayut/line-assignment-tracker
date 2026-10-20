<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AssignmentForm from './AssignmentForm.vue';
import { api, ApiError } from '../lib/api';
import { daysBetween, today, toInput } from '../lib/format';
import { createAssignment, deleteAssignment, store, toast, updateAssignment } from '../lib/store';
import type { Assignment, AssignmentInput } from '../lib/types';

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ close: [] }>();

const isNew = computed(() => props.id === 'new');
const original = ref<Assignment | null>(null);
const form = ref<AssignmentInput>({
  title: '',
  courseId: null,
  type: 'ASSIGNMENT',
  status: 'NOT_STARTED',
  startDate: today(),
  dueDate: null,
  dueTime: null,
  details: '',
});
const loading = ref(!isNew.value);
const saving = ref(false);
const error = ref('');
const showSource = ref(false);

onMounted(async () => {
  document.addEventListener('keydown', onKey);
  if (isNew.value) return;
  try {
    const a = store.assignments.find((x) => x.id === props.id) ?? (await api<Assignment>(`/assignments/${props.id}`));
    original.value = a;
    form.value = toInput(a);
  } catch {
    toast('Card not found');
    emit('close');
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

const invalid = computed(
  () =>
    !form.value.title.trim() ||
    !form.value.startDate ||
    Boolean(form.value.dueDate && daysBetween(form.value.startDate, form.value.dueDate) < 0),
);

async function save() {
  saving.value = true;
  error.value = '';
  try {
    if (isNew.value) await createAssignment(form.value);
    else await updateAssignment(props.id, form.value);
    toast('Saved');
    emit('close');
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not save';
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirm('Delete this card?')) return;
  try {
    await deleteAssignment(props.id);
    toast('Deleted');
    emit('close');
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not delete';
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" @click.self="emit('close')">
    <div class="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <div class="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 class="font-semibold">{{ isNew ? 'New card' : 'Edit card' }}</h2>
        <button class="rounded-lg p-1.5 text-muted hover:bg-black/5" aria-label="Close" @click="emit('close')">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="overflow-y-auto px-5 py-4">
        <div v-if="loading" class="py-10 text-center text-sm text-muted">Loading…</div>
        <template v-else>
          <AssignmentForm v-model="form" :courses="store.courses" show-status />

          <div v-if="original && (original.hasImage || original.sourceText)" class="mt-5 rounded-xl border border-line">
            <button class="flex w-full items-center justify-between px-4 py-2.5 text-sm text-muted" @click="showSource = !showSource">
              <span>{{ original.hasImage ? 'Original screenshot' : 'Original message' }}</span>
              <span>{{ showSource ? 'Hide' : 'Show' }}</span>
            </button>
            <div v-if="showSource" class="border-t border-line p-3">
              <a v-if="original.hasImage" :href="`/api/assignments/${original.id}/image`" target="_blank" rel="noopener">
                <img :src="`/api/assignments/${original.id}/image`" class="mx-auto max-h-[60vh] rounded-lg" alt="Original screenshot" />
              </a>
              <pre v-if="original.sourceText" class="whitespace-pre-wrap font-sans text-sm text-muted">{{ original.sourceText }}</pre>
            </div>
          </div>
        </template>
      </div>

      <div class="flex items-center gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button v-if="!isNew" class="btn btn-danger" @click="remove">Delete</button>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="ml-auto flex gap-2">
          <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" :disabled="invalid || saving || loading" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
