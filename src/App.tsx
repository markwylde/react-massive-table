import * as React from 'react';
import { DemoProvider, useDemo } from './context/DemoContext';
import AllFeaturesPage from './pages/All';
import BasicPage from './pages/Basic';
import CustomPage from './pages/Custom';
import GroupingPage from './pages/Grouping';
import LayoutPage from './pages/Layout';
import LogsPage from './pages/Logs';
import ReorderPage from './pages/Reorder';
import ResizePage from './pages/Resize';
import SortingPage from './pages/Sorting';
import VisibilityPage from './pages/Visibility';
import { useHashRoute } from './router';

const rowOptions = [
  { label: '10 rows', value: 10 },
  { label: '100 rows', value: 100 },
  { label: '1,000 rows', value: 1_000 },
  { label: '10,000 rows (default)', value: 10_000 },
  { label: '100,000 rows', value: 100_000 },
  { label: '250,000 rows (slow)', value: 250_000 },
  { label: '500,000 rows (slow)', value: 500_000 },
  { label: '1,000,000 rows (slow)', value: 1_000_000 },
];

const routes = [
  { key: 'basic', title: 'Basic' },
  { key: 'visibility', title: 'Column Visibility' },
  { key: 'logs', title: 'Logs (inline group)' },
  { key: 'custom', title: 'Custom Render' },
  { key: 'sorting', title: 'Sorting' },
  { key: 'reorder', title: 'Column Reorder' },
  { key: 'resize', title: 'Column Resize' },
  { key: 'grouping', title: 'Grouping' },
  { key: 'all', title: 'All Features' },
  { key: 'layout', title: 'Layout (grid + flex)' },
] as const;

function Shell() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const topbarRef = React.useRef<HTMLDivElement | null>(null);
  const [topbarH, setTopbarH] = React.useState<number>(56);
  React.useLayoutEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const update = () => setTopbarH(el.offsetHeight || 56);
    update();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } catch {}
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);

  const { mode, setMode, rowCount, startGeneration, isGenerating } = useDemo();
  const { key, variant, navigate } = useHashRoute('basic');

  return (
    <div
      className="app"
      data-theme={mode}
      data-sidebar-open={sidebarOpen ? 'true' : 'false'}
      style={{ ['--app-topbar-h' as string]: `${topbarH}px` }}
    >
      <div className="topbar" ref={topbarRef}>
        <div className="brand">
          <button
            type="button"
            className="burger"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <h1>MassiveTable Examples</h1>
        </div>
        <div className="topbar-actions">
          <span className="subtle">Rows</span>
          <select
            value={rowCount}
            onChange={(e) => startGeneration(Number(e.target.value))}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className="rows-select"
          >
            {rowOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isGenerating && <span className="spinner" aria-hidden="true" />}
          <span className="subtle" style={{ marginLeft: 12 }}>
            Theme
          </span>
          <fieldset className="segmented" aria-label="Theme toggle">
            <button
              className={mode === 'light' ? 'active' : ''}
              onClick={() => setMode('light')}
              type="button"
              aria-pressed={mode === 'light'}
            >
              Light
            </button>
            <button
              className={mode === 'dark' ? 'active' : ''}
              onClick={() => setMode('dark')}
              type="button"
              aria-pressed={mode === 'dark'}
            >
              Dark
            </button>
          </fieldset>
          <a
            href="https://github.com/markwylde/react-massive-table"
            target="_blank"
            rel="noreferrer"
            className="topbar-icon"
            aria-label="GitHub repository"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.699-2.782.604-3.369-1.342-3.369-1.342-.455-1.157-1.11-1.466-1.11-1.466-.907-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.338-2.222-.253-4.555-1.111-4.555-4.944 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.338 1.909-1.294 2.748-1.025 2.748-1.025.546 1.378.203 2.397.1 2.65.64.699 1.028 1.592 1.028 2.683 0 3.842-2.337 4.688-4.566 4.938.359.309.679.918.679 1.852 0 1.337-.012 2.416-.012 2.744 0 .267.18.577.688.479C19.138 20.162 22 16.417 22 12 22 6.477 17.523 2 12 2z"
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              GitHub repository
            </span>
          </a>
        </div>
      </div>

      <div className="shell">
        <aside id="app-sidebar" className="sidebar" aria-label="Example navigation">
          <div className="section">
            <div className="section-title">Examples</div>
            <nav>
              <div className="nav-group">
                {routes.map((r) => (
                  <a
                    key={r.key}
                    href={`#/${r.key}`}
                    className={key === r.key ? 'nav-title active' : 'nav-title'}
                    onClick={(ev) => {
                      ev.preventDefault();
                      navigate(r.key, 0);
                      setSidebarOpen(false);
                    }}
                  >
                    {r.title}
                  </a>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        <main className="main">
          {key === 'basic' && (
            <BasicPage variantIndex={variant} onVariantChange={(i) => navigate('basic', i)} />
          )}
          {key === 'visibility' && <VisibilityPage />}
          {key === 'logs' && (
            <LogsPage variantIndex={variant} onVariantChange={(i) => navigate('logs', i)} />
          )}
          {key === 'custom' && (
            <CustomPage variantIndex={variant} onVariantChange={(i) => navigate('custom', i)} />
          )}
          {key === 'sorting' && (
            <SortingPage variantIndex={variant} onVariantChange={(i) => navigate('sorting', i)} />
          )}
          {key === 'reorder' && (
            <ReorderPage variantIndex={variant} onVariantChange={(i) => navigate('reorder', i)} />
          )}
          {key === 'resize' && (
            <ResizePage variantIndex={variant} onVariantChange={(i) => navigate('resize', i)} />
          )}
          {key === 'grouping' && (
            <GroupingPage variantIndex={variant} onVariantChange={(i) => navigate('grouping', i)} />
          )}
          {key === 'all' && (
            <AllFeaturesPage variantIndex={variant} onVariantChange={(i) => navigate('all', i)} />
          )}
          {key === 'layout' && <LayoutPage />}
        </main>
      </div>
      <button
        type="button"
        className="backdrop"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}
