import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Load Prism's defaults before the app theme so light/dark overrides win.
import 'prismjs/themes/prism.css';
import './app.css';

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
