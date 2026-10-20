// App data: assignments + courses, kept in one reactive store.
import { reactive } from 'vue';
import { api } from './api';
import type { Assignment, AssignmentInput, Course } from './types';

export const store = reactive({
  assignments: [] as Assignment[],
  courses: [] as Course[],
  loaded: false,
  loading: false,
  /** Card editor modal: an assignment id, 'new', or null when closed */
  editing: null as string | null,
  toast: '',
});

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string): void {
  store.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (store.toast = ''), 3500);
}

export async function loadAll(): Promise<void> {
  store.loading = true;
  try {
    const [assignments, courses] = await Promise.all([api<Assignment[]>('/assignments'), api<Course[]>('/courses')]);
    store.assignments = assignments;
    store.courses = courses;
    store.loaded = true;
  } finally {
    store.loading = false;
  }
}

async function refreshCourses(): Promise<void> {
  store.courses = await api<Course[]>('/courses');
}

function replace(a: Assignment): void {
  const i = store.assignments.findIndex((x) => x.id === a.id);
  if (i === -1) store.assignments.push(a);
  else store.assignments[i] = a;
}

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const a = await api<Assignment>('/assignments', { method: 'POST', body: input });
  replace(a);
  await refreshCourses();
  return a;
}

export async function updateAssignment(id: string, patch: Partial<AssignmentInput>): Promise<Assignment> {
  const a = await api<Assignment>(`/assignments/${id}`, { method: 'PATCH', body: patch });
  replace(a);
  await refreshCourses();
  return a;
}

export async function deleteAssignment(id: string): Promise<void> {
  await api(`/assignments/${id}`, { method: 'DELETE' });
  store.assignments = store.assignments.filter((a) => a.id !== id);
  await refreshCourses();
}

export async function saveCourse(id: string | null, body: Partial<Course>): Promise<void> {
  if (id) await api(`/courses/${id}`, { method: 'PATCH', body });
  else await api('/courses', { method: 'POST', body });
  await loadAll(); // course labels/colors appear on cards too
}

export async function deleteCourse(id: string): Promise<void> {
  await api(`/courses/${id}`, { method: 'DELETE' });
  await loadAll();
}
