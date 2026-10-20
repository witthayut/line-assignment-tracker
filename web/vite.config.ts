import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // Allow tunnel hosts (ngrok / cloudflared) so LINE can reach the dev server
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
