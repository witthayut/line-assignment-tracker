<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarOptions, EventDropArg, EventClickArg, EventInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { computed, ref } from 'vue';
import { addDays, courseShort } from '../lib/format';
import { store, toast, updateAssignment } from '../lib/store';

const hideDone = ref(false);
const isMobile = window.matchMedia('(max-width: 640px)').matches;

// Each card is a bar from its start date to its due date (FullCalendar's end date is exclusive, so +1 day).
const events = computed<EventInput[]>(() =>
  store.assignments
    .filter((a) => !(hideDone.value && a.status === 'COMPLETE'))
    .map((a) => {
      const color = a.course?.color ?? '#8b8576';
      const last = a.dueDate ?? a.startDate;
      return {
        id: a.id,
        title: `${courseShort(a)} · ${a.title}${a.dueTime ? ` (${a.dueTime})` : ''}`,
        start: a.startDate,
        end: addDays(last, 1),
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        classNames: a.status === 'COMPLETE' ? ['is-complete'] : [],
      };
    }),
);

async function moveDates(id: string, start: string, endExclusive: string | null, revert: () => void) {
  const a = store.assignments.find((x) => x.id === id);
  if (!a) return revert();
  const last = endExclusive ? addDays(endExclusive, -1) : start;
  try {
    await updateAssignment(id, a.dueDate ? { startDate: start, dueDate: last, dueTime: a.dueTime } : { startDate: start });
    toast('Dates updated');
  } catch {
    revert();
    toast('Could not move the card');
  }
}

const options = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, listPlugin, interactionPlugin],
  initialView: isMobile ? 'listMonth' : 'dayGridMonth',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,listMonth' },
  buttonText: { today: 'Today', month: 'Month', week: 'Week', list: 'List' },
  firstDay: 1,
  height: 'auto',
  dayMaxEvents: 4,
  editable: true,
  eventStartEditable: true,
  eventDurationEditable: true,
  events: events.value,
  eventClick: (info: EventClickArg) => {
    store.editing = info.event.id;
  },
  eventDrop: (info: EventDropArg) => {
    void moveDates(info.event.id, info.event.startStr.slice(0, 10), info.event.endStr ? info.event.endStr.slice(0, 10) : null, info.revert);
  },
  eventResize: (info: EventResizeDoneArg) => {
    void moveDates(info.event.id, info.event.startStr.slice(0, 10), info.event.endStr ? info.event.endStr.slice(0, 10) : null, info.revert);
  },
}));
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-xl font-semibold tracking-tight">Calendar</h1>
      <label class="flex items-center gap-2 text-sm text-muted">
        <input v-model="hideDone" type="checkbox" class="rounded" />
        Hide completed
      </label>
    </div>

    <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span v-for="c in store.courses" :key="c.id" class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: c.color }" />
        {{ c.code ?? c.name }}
      </span>
      <span class="ml-auto hidden sm:inline">Bars run from start date to deadline · drag to change dates</span>
    </div>

    <div class="rounded-2xl border border-line bg-white p-3 sm:p-4">
      <FullCalendar :options="options" />
    </div>
  </div>
</template>
