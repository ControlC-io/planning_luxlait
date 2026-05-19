import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow any host so dev server works behind Coolify / reverse proxies
    // (sslip.io domains, custom domains, etc.).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: (process.env.BACKEND_PROXY_URL ?? 'http://localhost:3000').trim(),
        changeOrigin: true,
      },
    },
  },
});
