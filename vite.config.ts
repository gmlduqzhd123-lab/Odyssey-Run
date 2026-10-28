import {defineConfig, type Plugin} from 'vite';
// A second line of defence for text that arrives in share links (#g, #c, #r): everything shown is
// HTML-escaped already, and this policy also keeps the page from running any script or loading
// anything that is not part of the game itself. Styles stay inline-capable (style attributes and
// the install/QR helpers). Added to the built page only; the dev server injects its own scripts.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
const contentSecurityPolicy = (): Plugin => ({
  name: 'odyssey-csp',
  apply: 'build',
  transformIndexHtml: html =>
    html.replace(
      '<meta charset="UTF-8">',
      `<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    ),
});
// Default to the linked GitHub project path; override for another hosting path.
// Actions passes the actual repository path through PAGES_BASE.
export default defineConfig({
  base: process.env.PAGES_BASE || '/Odyssey-Run/',
  plugins: [contentSecurityPolicy()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1300,
    // Phaser changes far less often than the game, so it keeps its file name (and cache) across releases.
    rollupOptions: {output: {manualChunks: id => (id.includes('/node_modules/phaser/') ? 'phaser' : undefined)}},
  },
});
