import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { bootstrapAuth, session } from './lib/auth';
import { setUnauthorizedHandler } from './lib/api';
import './style.css';

async function start(): Promise<void> {
  await bootstrapAuth();
  setUnauthorizedHandler(() => {
    session.user = null;
    router.push({ name: 'login', query: { next: router.currentRoute.value.fullPath } });
  });
  createApp(App).use(router).mount('#app');
}

void start();
