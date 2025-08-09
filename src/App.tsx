import Chance from 'chance';
import * as React from 'react';
import Tabletron from './lib/Tabletron';
import type { ColumnDef, ColumnPath, GetRowsResult, RowsRequest, Sort } from './lib/types';
import { getByPath } from './lib/utils';

type Row = {
  index: number;
  firstName: string;
  lastName: string;
  category: 'one' | 'two' | null;
  favourites: { colour: string; number: number };
};

type GroupHeader = {
  __group: true;
  key: string;
  depth: number;
  value: unknown;
  count: number;
  path: ColumnPath;
};

const SEED = 1337;
// Use a smaller dataset in the demo so client-side sorting is fast
const rowCount = 10_000;

function makeRow(i: number): Row {
  // Seed per row so we can generate deterministically on demand
  const c = new Chance(`${SEED}-${i}`);
  return {
    index: i + 1,
    firstName: c.first(),
    lastName: c.last(),
    category: c.pick(['one', 'two', null]),
    favourites: {
      colour: c.color({ format: 'name' }),
      number: c.integer({ min: 1, max: 100 }),
    },
  };
}

const columns: ColumnDef<Row | GroupHeader>[] = [
  { path: ['index'], title: '#', width: 80, align: 'right' },
  { path: ['category'], title: 'Category', width: 200, align: 'left' },
  { path: ['favourites', 'colour'], title: 'Favourite Colour', width: 200 },
  { path: ['favourites', 'number'], title: 'Favourite Number', width: 140, align: 'right' },
  { path: ['lastName'], title: 'Last Name', width: 220 },
  { path: ['firstName'], title: 'First Name' },
];

export default function App() {
  const [mode, setMode] = React.useState<'light' | 'dark'>(
    () => (localStorage.getItem('tabletron-mode') as 'light' | 'dark') || 'light',
  );
  React.useEffect(() => {
    try {
      localStorage.setItem('tabletron-mode', mode);
    } catch {}
  }, [mode]);
  // Build demo data in-memory (deterministic via Chance + SEED)
  const data = React.useMemo(() => Array.from({ length: rowCount }, (_, i) => makeRow(i)), []);

  // Cache sorted arrays per sorts signature
  const sortedCacheRef = React.useRef<Map<string, Row[]>>(new Map());
  const groupedCacheRef = React.useRef<Map<string, (Row | GroupHeader)[]>>(new Map());
  const getRows = React.useCallback(
    (start: number, end: number, req?: RowsRequest<Row>): GetRowsResult<Row | GroupHeader> => {
      const len = Math.max(0, end - start);
      const sorts = req?.sorts ?? [];
      const groupBy = req?.groupBy ?? [];
      const expandedSet = new Set(req?.groupState?.expandedKeys ?? []);

      // Sort stage (cache by sorts signature)
      const sortSig = sorts.map((s) => `${JSON.stringify(s.path)}:${s.dir}`).join('|');
      let sorted = sortedCacheRef.current.get(sortSig);
      if (!sorted) {
        if (sorts.length === 0) {
          sorted = data;
        } else {
          const cmp = (a: Row, b: Row) => {
            for (const s of sorts) {
              const va = getByPath(a, s.path);
              const vb = getByPath(b, s.path);
              if (va == null && vb == null) continue;
              if (va == null) return s.dir === 'asc' ? 1 : -1; // nulls last
              if (vb == null) return s.dir === 'asc' ? -1 : 1;
              let d = 0;
              if (typeof va === 'number' && typeof vb === 'number') {
                d = va - vb;
              } else {
                const sa = String(va).toLocaleString();
                const sb = String(vb).toLocaleString();
                d = sa < sb ? -1 : sa > sb ? 1 : 0;
              }
              if (d !== 0) return s.dir === 'asc' ? d : -d;
            }
            return 0;
          };
          sorted = data.slice().sort(cmp);
        }
        sortedCacheRef.current.set(sortSig, sorted);
        if (sortedCacheRef.current.size > 8) {
          const firstKey = sortedCacheRef.current.keys().next().value as string | undefined;
          if (firstKey) sortedCacheRef.current.delete(firstKey);
        }
      }

      // If no grouping, return slice of sorted data
      if (groupBy.length === 0) {
        return { rows: sorted.slice(start, start + len), total: sorted.length };
      }

      // Grouping stage (cache by sorts + groupBy + expanded keys)
      const gbSig = groupBy.map((g) => JSON.stringify(g.path)).join('|');
      const exSig = Array.from(expandedSet).sort().join('|');
      const key = `${sortSig}::${gbSig}::${exSig}`;
      let flattened = groupedCacheRef.current.get(key);
      if (!flattened) {
        const paths = groupBy.map((g) => g.path);
        // Build a recursive grouping tree and flatten according to expandedSet
        type GroupNode = {
          key: string;
          depth: number;
          value: unknown;
          rows: Row[];
          children?: Map<string, GroupNode>;
        };
        const root: GroupNode = { key: 'root', depth: 0, value: null, rows: sorted };
        const build = (node: GroupNode, depth: number) => {
          if (depth >= paths.length) return;
          const path = paths[depth];
          const map = new Map<string, GroupNode>();
          for (const r of node.rows) {
            const v = getByPath(r, path);
            const k = JSON.stringify([
              ...(JSON.parse(node.key === 'root' ? '[]' : node.key) as unknown[]),
              v,
            ]);
            let child = map.get(k);
            if (!child) {
              child = { key: k, depth, value: v, rows: [] } as GroupNode;
              map.set(k, child);
            }
            child.rows.push(r);
          }
          node.children = map;
          for (const c of map.values()) build(c, depth + 1);
        };
        build(root, 0);

        const out: (Row | GroupHeader)[] = [];
        const flatten = (node: GroupNode) => {
          if (!node.children) return;
          for (const child of node.children.values()) {
            const header = {
              __group: true,
              key: child.key,
              depth: child.depth,
              value: child.value,
              count: child.rows.length,
              path: paths[child.depth],
            } as GroupHeader;
            out.push(header);
            const isExpanded = expandedSet.has(child.key);
            if (isExpanded) {
              if (child.children) {
                flatten(child);
              } else {
                out.push(...child.rows);
              }
            }
          }
        };
        flatten(root);
        flattened = out;
        groupedCacheRef.current.set(key, flattened);
        if (groupedCacheRef.current.size > 8) {
          const firstKey = groupedCacheRef.current.keys().next().value as string | undefined;
          if (firstKey) groupedCacheRef.current.delete(firstKey);
        }
      }
      return { rows: flattened.slice(start, start + len), total: flattened.length };
    },
    [data],
  );

  // Storybook-like example registry
  type Variant = {
    name: string;
    props: Partial<React.ComponentProps<typeof Tabletron<Row | GroupHeader>>>;
    note?: string;
  };
  type Example = { key: string; title: string; variants: Variant[] };

  const examples: Example[] = React.useMemo(
    () => [
      {
        key: 'basic',
        title: 'Basic',
        variants: [
          {
            name: 'Basic Table',
            props: {}, // rely on component defaults (all features off)
            note: 'No sort, no reorder, no resize, no group bar.',
          },
        ],
      },
      {
        key: 'sorting',
        title: 'Sorting',
        variants: [
          { name: 'Enable Sorting', props: { enableSort: true } },
          {
            name: 'Default Sorts',
            props: {
              enableSort: true,
              defaultSorts: [{ path: ['lastName'], dir: 'asc' }] as Sort[],
            },
            note: 'Pre-sorted by Last Name ascending.',
          },
        ],
      },
      {
        key: 'reorder',
        title: 'Column Reorder',
        variants: [{ name: 'Enable Reorder', props: { enableReorder: true } }],
      },
      {
        key: 'resize',
        title: 'Column Resize',
        variants: [{ name: 'Enable Resize', props: { enableResize: true } }],
      },
      {
        key: 'grouping',
        title: 'Grouping',
        variants: [
          { name: 'Show Group Bar', props: { showGroupByDropZone: true } },
          {
            name: 'Preset Group By Category',
            props: { showGroupByDropZone: true, defaultGroupBy: [{ path: ['category'] }] },
          },
          {
            name: 'Preset Group + Expanded',
            props: {
              showGroupByDropZone: true,
              defaultGroupBy: [{ path: ['category'] }],
              defaultExpandedKeys: ['["one"]', '["two"]', '[null]'],
            },
          },
        ],
      },
      {
        key: 'all',
        title: 'All Features',
        variants: [
          {
            name: 'Sortable + Reorder + Resize + Group Bar',
            props: {
              enableSort: true,
              enableReorder: true,
              enableResize: true,
              showGroupByDropZone: true,
            },
          },
        ],
      },
    ],
    [],
  );

  // Basic hash router: #/exampleKey or #/exampleKey/variantIndex
  const [activeExampleKey, setActiveExampleKey] = React.useState<string>('basic');
  const activeExample = examples.find((e) => e.key === activeExampleKey) ??
    examples[0] ?? { key: 'fallback', title: 'Fallback', variants: [] };
  const [activeVariantIndex, setActiveVariantIndex] = React.useState<number>(0);
  // Sync from URL hash on load and when it changes
  React.useEffect(() => {
    const parse = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const parts = hash.split('/').filter(Boolean); // [exampleKey, variantIdx?]
      const nextKey = parts[0] || 'basic';
      const found = examples.find((e) => e.key === nextKey);
      if (!found) {
        setActiveExampleKey('basic');
        setActiveVariantIndex(0);
        return;
      }
      setActiveExampleKey(found.key);
      const idx = parts[1] ? Number(parts[1]) : 0;
      const safeIdx = Number.isFinite(idx)
        ? Math.max(0, Math.min(idx, found.variants.length - 1))
        : 0;
      setActiveVariantIndex(Number.isNaN(safeIdx) ? 0 : safeIdx);
    };
    window.addEventListener('hashchange', parse);
    parse();
    return () => window.removeEventListener('hashchange', parse);
  }, [examples]);

  // Navigate helper
  const navigate = React.useCallback((key: string, variant?: number) => {
    const v = typeof variant === 'number' ? `/${variant}` : '';
    const next = `#/${key}${v}`;
    if (window.location.hash !== next) window.location.hash = next;
  }, []);

  const activeVariant = activeExample.variants[activeVariantIndex] ??
    activeExample.variants[0] ?? { name: 'Variant', props: {} };

  // Keep order state to display in reorder example
  const [order, setOrder] = React.useState<number[]>([]);
  const [previewOrder, setPreviewOrder] = React.useState<number[] | null>(null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div
        style={{
          padding: 12,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Tabletron Examples</h1>
          {activeExample.key === 'reorder' && (
            <span style={{ color: '#555' }}>
              {previewOrder
                ? `Preview order: ${previewOrder.join(', ')}`
                : `Final order: ${order.join(', ') || '(default)'}`}
            </span>
          )}
          {activeExample.key === 'sorting' && (
            <span style={{ color: '#555' }}>Shift+click headers to multi-sort.</span>
          )}
        </div>
        <fieldset
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: 0,
            margin: 0,
            padding: 0,
          }}
        >
          <legend style={{ fontSize: 12, color: '#555' }}>Theme</legend>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 999,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setMode('light')}
              type="button"
              style={{
                padding: '6px 10px',
                background: mode === 'light' ? '#1118270f' : 'transparent',
                border: 0,
                cursor: 'pointer',
              }}
            >
              Light
            </button>
            <button
              onClick={() => setMode('dark')}
              type="button"
              style={{
                padding: '6px 10px',
                background: mode === 'dark' ? '#1118270f' : 'transparent',
                border: 0,
                cursor: 'pointer',
              }}
            >
              Dark
            </button>
          </div>
        </fieldset>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 280,
            borderRight: '1px solid #e2e8f0',
            padding: 12,
            overflow: 'auto',
          }}
        >
          {examples.map((ex) => (
            <div key={ex.key} style={{ marginBottom: 8 }}>
              <a
                href={`#/${ex.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(ex.key);
                }}
                style={{
                  display: 'block',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: ex.key === activeExampleKey ? '#111827' : 'inherit',
                  textDecoration: 'none',
                  padding: '6px 0',
                }}
              >
                {ex.title}
              </a>
              {ex.key === activeExampleKey && (
                <ul style={{ listStyle: 'none', paddingLeft: 12, margin: '6px 0 8px 0' }}>
                  {ex.variants.map((v, i) => (
                    <li key={v.name} style={{ marginBottom: 4 }}>
                      <a
                        href={`#/${ex.key}/${i}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(ex.key, i);
                        }}
                        style={{
                          display: 'block',
                          background: i === activeVariantIndex ? '#1118270f' : 'transparent',
                          border: 0,
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          color: 'inherit',
                          textDecoration: 'none',
                        }}
                      >
                        {v.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, padding: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{activeExample.title}</h2>
            <p style={{ margin: 0, color: '#555' }}>
              {activeVariant.name}
              {activeVariant.note ? ` — ${activeVariant.note}` : ''}
            </p>
          </div>
          <Tabletron<Row | GroupHeader>
            getRows={getRows}
            rowCount={rowCount}
            columns={columns}
            mode={mode}
            {...activeVariant.props}
            onColumnOrderPreviewChange={(o) => setPreviewOrder(o)}
            onColumnOrderChange={(o) => {
              setOrder(o);
              setPreviewOrder(null);
            }}
            style={{ height: '80vh', width: '100%' }}
          />
        </main>
      </div>
    </div>
  );
}
