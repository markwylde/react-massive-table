import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Separate config to build the demo site from index.html
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep library build output in dist, and site output separate
    outDir: 'site',
  },
});

