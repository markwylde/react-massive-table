import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const srcDir = resolve(root, 'src/lib/styles');
const distStylesDir = resolve(root, 'dist/styles');
const distThemesDir = resolve(root, 'dist/themes');
const distStylesCss = resolve(root, 'dist/react-massive-table.css');

function ensureDir(p) {
  try {
    mkdirSync(p, { recursive: true });
  } catch {}
}

function copy(from, to) {
  ensureDir(dirname(to));
  copyFileSync(from, to);
  console.log(`copied ${from.replace(root+'/', '')} -> ${to.replace(root+'/', '')}`);
}

ensureDir(distStylesDir);
ensureDir(distThemesDir);

copy(resolve(srcDir, 'base.module.css'), resolve(distStylesDir, 'base.module.css'));
copy(resolve(srcDir, 'light.module.css'), resolve(distThemesDir, 'light.module.css'));
copy(resolve(srcDir, 'dark.module.css'), resolve(distThemesDir, 'dark.module.css'));

// Keep legacy export for side-effect CSS import path present (empty by design)
writeFileSync(distStylesCss, '/* react-massive-table: no automatic CSS; import CSS modules instead */\n');
console.log(`wrote dist/react-massive-table.css (stub)`);
