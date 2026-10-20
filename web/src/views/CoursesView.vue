<script setup lang="ts">
import { ref } from 'vue';
import { ApiError } from '../lib/api';
import { deleteCourse, saveCourse, store, toast } from '../lib/store';
import type { Course } from '../lib/types';

const COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#059669'];

const editingId = ref<string | null>(null); // course id, 'new', or null
const draft = ref({ code: '', name: '', professor: '', color: COLORS[0] });
const error = ref('');

function startNew() {
  editingId.value = 'new';
  draft.value = { code: '', name: '', professor: '', color: COLORS[store.courses.length % COLORS.length] };
  error.value = '';
}

function startEdit(c: Course) {
  editingId.value = c.id;
  draft.value = { code: c.code ?? '', name: c.name, professor: c.professor ?? '', color: c.color };
  error.value = '';
}

async function save() {
  try {
    await saveCourse(editingId.value === 'new' ? null : editingId.value, draft.value);
    editingId.value = null;
    toast('Course saved');
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not save';
  }
}

async function remove(c: Course) {
  if (!confirm(`Delete ${c.code ?? c.name}? Its cards stay, without a course.`)) return;
  await deleteCourse(c.id);
  toast('Course deleted');
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-2 flex items-center">
      <h1 class="mr-auto text-xl font-semibold tracking-tight">Courses</h1>
      <button class="btn btn-ghost" @click="startNew">+ Add course</button>
    </div>
    <p class="mb-5 text-sm text-muted">The bot uses this list to match posts to the right course. Courses it sees for the first time are added automatically when you confirm.</p>

    <form v-if="editingId === 'new'" class="mb-3 space-y-3 rounded-xl border border-line bg-white p-4" @submit.prevent="save">
      <div class="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <input v-model="draft.code" class="field" placeholder="Code (ITCS258)" />
        <input v-model="draft.name" class="field" placeholder="Course name" required />
      </div>
      <input v-model="draft.professor" class="field" placeholder="Professor (optional)" />
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="col in COLORS"
          :key="col"
          type="button"
          class="h-6 w-6 rounded-full ring-offset-2"
          :class="{ 'ring-2 ring-ink': draft.color === col }"
          :style="{ background: col }"
          :aria-label="col"
          @click="draft.color = col"
        />
        <div class="ml-auto flex gap-2">
          <button type="button" class="btn btn-ghost" @click="editingId = null">Cancel</button>
          <button class="btn btn-primary">Save</button>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </form>

    <div class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      <p v-if="store.courses.length === 0 && editingId !== 'new'" class="px-4 py-10 text-center text-sm text-muted">No courses yet.</p>

      <div v-for="c in store.courses" :key="c.id">
        <form v-if="editingId === c.id" class="space-y-3 p-4" @submit.prevent="save">
          <div class="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <input v-model="draft.code" class="field" placeholder="Code" />
            <input v-model="draft.name" class="field" placeholder="Course name" required />
          </div>
          <input v-model="draft.professor" class="field" placeholder="Professor (optional)" />
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="col in COLORS"
              :key="col"
              type="button"
              class="h-6 w-6 rounded-full ring-offset-2"
              :class="{ 'ring-2 ring-ink': draft.color === col }"
              :style="{ background: col }"
              :aria-label="col"
              @click="draft.color = col"
            />
            <div class="ml-auto flex gap-2">
              <button type="button" class="btn btn-ghost" @click="editingId = null">Cancel</button>
              <button class="btn btn-primary">Save</button>
            </div>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>

        <div v-else class="flex items-center gap-3 px-4 py-3">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: c.color }" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">
              <span v-if="c.code" class="mr-1.5 text-muted">{{ c.code }}</span>{{ c.name }}
            </p>
            <p v-if="c.professor" class="truncate text-xs text-muted">{{ c.professor }}</p>
          </div>
          <span class="text-xs text-muted">{{ c.openCount }} open</span>
          <button class="btn btn-ghost !px-2 !py-1 text-xs" @click="startEdit(c)">Edit</button>
          <button class="btn btn-danger !px-2 !py-1 text-xs" @click="remove(c)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>
