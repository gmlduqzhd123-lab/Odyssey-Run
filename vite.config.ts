import {defineConfig} from 'vite';
// Default to the linked GitHub project path; override for another hosting path.
// Actions passes the actual repository path through PAGES_BASE.
export default defineConfig({
  base: process.env.PAGES_BASE || '/Odyssey-Run/',
  build: {target: 'es2022', chunkSizeWarningLimit: 1600},
});
