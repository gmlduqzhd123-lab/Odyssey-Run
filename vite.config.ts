import { defineConfig } from 'vite';
// Relative assets work before a repository is linked, including any Pages subpath.
// Actions passes the actual repository path through PAGES_BASE.
export default defineConfig({base: process.env.PAGES_BASE || './', build: {target:'es2022', chunkSizeWarningLimit:1600}});
