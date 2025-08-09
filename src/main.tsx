import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';
// Prism theme (can swap for other themes)
import 'prismjs/themes/prism.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
