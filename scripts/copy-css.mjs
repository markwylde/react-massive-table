import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const srcDir = resolve(root, 'src/lib/styles');
const distStylesDir = resolve(root, 'dist/styles');
const distThemesDir = resolve(root, 'dist/themes');
const distStylesCss = resolve(root, 'dist/react-massive-table.css');
const distTypesDir = resolve(root, 'dist/types');
const distCssTypes = resolve(distTypesDir, 'css-modules.d.ts');

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
ensureDir(distTypesDir);

copy(resolve(srcDir, 'base.module.css'), resolve(distStylesDir, 'base.module.css'));
copy(resolve(srcDir, 'light.module.css'), resolve(distThemesDir, 'light.module.css'));
copy(resolve(srcDir, 'dark.module.css'), resolve(distThemesDir, 'dark.module.css'));

// Keep legacy export for side-effect CSS import path present (empty by design)
writeFileSync(distStylesCss, '/* react-massive-table: no automatic CSS; import CSS modules instead */\n');
console.log(`wrote dist/react-massive-table.css (stub)`);

// Provide type declarations for CSS module subpath exports so TS consumers don't warn
const cssModuleDts = `
declare module 'react-massive-table/styles/base.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module 'react-massive-table/themes/light.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module 'react-massive-table/themes/dark.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module 'react-massive-table/styles.css' {
  // Side-effect only CSS import
}
`;
writeFileSync(distCssTypes, cssModuleDts);
console.log(`wrote ${distCssTypes.replace(root+'/', '')}`);
