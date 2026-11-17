import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function paperPlanesApiPlugin(): Plugin {
  return {
    name: 'paper-planes-api',
    async configureServer(server) {
      // Load server-only env vars from .env into Node process.env (never exposed to client unless VITE_-prefixed)
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      const [{ getRequestListener }, { app }] = await Promise.all([
        import('@hono/node-server'),
        import('./server/app'),
      ]);
      const listener = getRequestListener(app.fetch);
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }
        return listener(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), paperPlanesApiPlugin()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
