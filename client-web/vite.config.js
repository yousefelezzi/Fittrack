import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_URL || 'http://server:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      // Uploaded avatars and post photos are served by the API server.
      '/uploads': { target: apiTarget, changeOrigin: true },
    },
  },
});
