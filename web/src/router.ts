import { createRouter, createWebHistory } from 'vue-router';
import { session } from './lib/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'board', component: () => import('./views/BoardView.vue') },
    { path: '/calendar', name: 'calendar', component: () => import('./views/CalendarView.vue') },
    { path: '/upcoming', name: 'upcoming', component: () => import('./views/UpcomingView.vue') },
    { path: '/courses', name: 'courses', component: () => import('./views/CoursesView.vue') },
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { bare: true, public: true } },
    // Opened from the "Edit" button on the LINE card (inside LINE)
    { path: '/liff/drafts/:id', name: 'liff-draft', component: () => import('./views/LiffDraftView.vue'), meta: { bare: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) {
    if (to.name === 'login' && session.user) return (to.query.next as string) || '/';
    return true;
  }
  if (!session.user) return { name: 'login', query: { next: to.fullPath } };
  return true;
});
