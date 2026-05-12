import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend_api:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
  },
});
