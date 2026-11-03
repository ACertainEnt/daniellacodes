import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Arena proxies each listening port as https://{port}-{sandboxId}.e2b.app.
// Naming it explicitly keeps Vite's generated HMR client free of localhost
// fallbacks; the Express bootstrap attaches HMR to its own HTTP server.
const previewPort = Number(process.env.PORT || 5173);
const previewHost = process.env.E2B_SANDBOX_ID
  ? `${previewPort}-${process.env.E2B_SANDBOX_ID}.e2b.app`
  : undefined;

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
    // The proxied preview host is reached over HTTPS on port 443. The Express
    // bootstrap attaches HMR to its own HTTP server (hmr.server), so the
    // websocket shares this single origin instead of opening a second port.
    hmr: { clientPort: 443, ...(previewHost ? { host: previewHost } : {}) },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
