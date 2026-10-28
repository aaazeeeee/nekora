import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('prosemirror')) return 'prosemirror';
          if (id.includes('/@tiptap/')) return 'tiptap';
          if (id.includes('/@supabase/')) return 'supabase';
        },
      },
    },
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.e2e-dist/**'],
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    clearMocks: true,
  },
});
