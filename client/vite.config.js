import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client talks to the server over REST (VITE_API_URL) and Socket.io. In dev we
// proxy /api and /socket.io to the server so the browser sees a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy, cacheable vendors (recharts/d3 and the socket client) into
        // their own chunks so the initial route payload stays lean.
        manualChunks: {
          charts: ['recharts'],
          realtime: ['socket.io-client'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
