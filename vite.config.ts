import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_RUNTIME_ENV": JSON.stringify(
      process.env.VERCEL_ENV ?? (mode === "development" ? "development" : "production"),
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
}));
