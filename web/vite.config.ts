import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { reviewTool } from './vite-plugins/review';

export default defineConfig(({ command }) => ({
  // The review tool writes to disk. It is added ONLY when serving, and the
  // plugin itself also declares apply: 'serve' — two independent gates, because
  // either alone is one mistake away from shipping a file writer.
  plugins: [react(), tailwindcss(),
            ...(command === 'serve' ? [reviewTool(new URL('..', import.meta.url).pathname)] : [])],
  // Served from a repository subpath on GitHub Pages; relative base keeps it
  // working from any prefix and from file:// during review.
  base: './',
  build: {
    target: 'es2022',
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // The scheduler and the palette are not needed to paint the first
        // screen, so they get their own chunks and are fetched on demand.
        manualChunks(id) {
          if (id.includes('ts-fsrs')) return 'scheduler';
          if (id.includes('react-router')) return 'router';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
}));
