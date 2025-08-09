import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';
// Prism theme (can swap for other themes)
import 'prismjs/themes/prism.css';

// Apply an initial theme attribute before React mounts to prevent FOUC
try {
  const saved = localStorage.getItem('massive-table-mode');
  let initial: 'light' | 'dark' = 'light';
  if (saved === 'light' || saved === 'dark') initial = saved;
  else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) initial = 'dark';
  document.documentElement.setAttribute('data-theme', initial);
  document.body?.setAttribute('data-theme', initial);
} catch {}

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
