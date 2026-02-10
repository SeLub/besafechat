import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    middlewareMode: false,
  },
  optimizeDeps: {
    include: ['@radix-ui/react-switch'],
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), mkcert()],
});
