import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The Express server mounts Vite in middleware mode, so there is only ONE
// origin and ONE port in development. Browser code always calls relative /api
// URLs — never localhost — which keeps the live preview working.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
