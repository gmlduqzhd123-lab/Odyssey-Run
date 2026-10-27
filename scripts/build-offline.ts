import {readFile, writeFile, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root = 'dist';
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const files = (await walk(root))
  .filter(p => !p.endsWith('sw.js') && !p.endsWith('offline-manifest.json'))
  .map(p => p.slice(root.length + 1))
  .sort();
const entries = await Promise.all(
  files.map(async path => {
    const data = await readFile(join(root, path));
    return {path, bytes: data.length, hash: createHash('sha256').update(data).digest('hex')};
  }),
);
const version = createHash('sha256')
  .update(JSON.stringify(entries))
  .update(await readFile('public/sw.js'))
  .update(await readFile('scripts/build-offline.ts'))
  .digest('hex')
  .slice(0, 16);
const home = [
  'index.html',
  'manifest.webmanifest',
  'ys-install.js',
  'ys-qr.js',
  'qr.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];
const core = entries.filter(
  f =>
    home.includes(f.path) ||
    /^assets\/index-.*\.(js|css)$/.test(f.path) ||
    /^assets\/(beach-(sky|far|mid)|boat)\.svg$/.test(f.path) ||
    (/^assets\/art\/(odysseus-|compass-|landscape-sheet-)/.test(f.path) && !f.path.includes('-run-')),
);
const remaining = entries.filter(f => !core.includes(f));
const stageSpecific = (path: string) =>
  path.startsWith('assets/audio/') || /^assets\/(beach|cave|wind)-(sky|far|mid)\.svg$/.test(path);
const shared = remaining.filter(f => !stageSpecific(f.path));
const groups = Object.fromEntries(
  ['beach', 'cave', 'wind'].map(stage => [
    stage,
    remaining.filter(
      f =>
        f.path.startsWith('assets/audio/' + stage + '-') ||
        new RegExp('^assets/' + stage + '-(sky|far|mid)\\.svg$').test(f.path),
    ),
  ]),
);
await writeFile(join(root, 'offline-manifest.json'), JSON.stringify({version, core, shared, groups}));
const sw = await readFile('public/sw.js', 'utf8');
await writeFile(join(root, 'sw.js'), sw.replace('__BUILD_VERSION__', version));
console.log(`Offline manifest ${version}: core ${core.reduce((n, f) => n + f.bytes, 0)} bytes; three island groups`);
