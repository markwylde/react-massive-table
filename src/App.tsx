import Chance from 'chance';
import * as React from 'react';
import MassiveTable from './lib/MassiveTable';
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

// Inline-group logs example types and data
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type LogRow = {
  id: number; // unique id
  ts: number; // timestamp (ms)
  level: LogLevel;
  message: string;
  trace_id: string | null;
  // for demo table columns
  index: number;
};

type LogRowWithMeta = LogRow & {
  __inlineGroupKey?: string;
  __inlineGroupAnchor?: boolean;
  __inlineGroupMember?: boolean;
  __inlineGroupExpanded?: boolean;
  __inlineGroupSize?: number;
};

// Helper to build demo logs dataset: 20 normal logs, 5 + 5 spans across 2 traces
function buildLogs(): LogRow[] {
  const base = Date.now() - 1000 * 60 * 60; // 1h ago
  const total = 30;
  const traceAidx = [3, 6, 12, 18, 24];
  const traceBidx = [5, 11, 15, 21, 27];
  const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const rows: LogRow[] = [];
  let id = 1;
  for (let i = 0; i < total; i++) {
    const ts = base + i * 60_000; // each minute
    let trace: string | null = null;
    if (traceAidx.includes(i)) trace = '1111111';
    else if (traceBidx.includes(i)) trace = '2222222';

    const level = levels[i % levels.length];
    const message = trace
      ? `Span ${trace === '1111111' ? traceAidx.indexOf(i) + 1 : traceBidx.indexOf(i) + 1} of 5 for trace ${trace}`
      : `Log message ${i + 1}`;
    rows.push({ id: id++, ts, level, message, trace_id: trace, index: i + 1 });
  }
  return rows;
}

export default function App() {
  const [mode, setMode] = React.useState<'light' | 'dark'>(
    () => (localStorage.getItem('massive-table-mode') as 'light' | 'dark') || 'light',
  );
  React.useEffect(() => {
    try {
      localStorage.setItem('massive-table-mode', mode);
    } catch {}
  }, [mode]);
  // Build demo data in-memory (deterministic via Chance + SEED)
  const data = React.useMemo(() => Array.from({ length: rowCount }, (_, i) => makeRow(i)), []);

  // Cache sorted arrays per sorts signature
  const sortedCacheRef = React.useRef<Map<string, Row[]>>(new Map());
  const groupedCacheRef = React.useRef<Map<string, (Row | GroupHeader)[]>>(new Map());
  const getRows = React.useCallback(
    (
      start: number,
      end: number,
      req?: RowsRequest<Row | GroupHeader>,
    ): GetRowsResult<Row | GroupHeader> => {
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

  // ------------------------
  // Logs inline-group example
  // ------------------------
  const logsData = React.useMemo(() => buildLogs(), []);
  const [logsExpandedKeys, setLogsExpandedKeys] = React.useState<string[]>([]);

  // generic compare using sorts; nulls last
  const makeComparator = React.useCallback(
    <T extends object>(sorts: Sort<T>[]) =>
      (a: T, b: T) => {
        for (const s of sorts) {
          const va = getByPath(a as unknown as Record<string, unknown>, s.path);
          const vb = getByPath(b as unknown as Record<string, unknown>, s.path);
          if (va == null && vb == null) continue;
          if (va == null) return s.dir === 'asc' ? 1 : -1;
          if (vb == null) return s.dir === 'asc' ? -1 : 1;
          let d = 0;
          if (typeof va === 'number' && typeof vb === 'number') d = va - vb;
          else {
            const sa = String(va).toLocaleString();
            const sb = String(vb).toLocaleString();
            d = sa < sb ? -1 : sa > sb ? 1 : 0;
          }
          if (d !== 0) return s.dir === 'asc' ? d : -d;
        }
        return 0;
      },
    [],
  );

  type AnyRow = Record<string, unknown> & { trace_id?: string | null; ts?: number };
  const getRowsLogs = React.useCallback(
    (start: number, end: number, req?: RowsRequest<AnyRow>): GetRowsResult<AnyRow> => {
      const sorts = (req?.sorts as Sort<AnyRow>[]) ?? [];
      // default to index desc (visible column) if no sorts
      const effectiveSorts =
        sorts.length > 0 ? sorts : ([{ path: ['index'], dir: 'desc' }] as Sort<AnyRow>[]);
      const cmp = makeComparator<AnyRow>(effectiveSorts);

      // Sort base data per user sorts
      const sorted = logsData
        .map((r) => r as AnyRow)
        .slice()
        .sort(cmp);

      // Build trace groups by trace_id (non-null) in the current sorted order
      const byTrace = new Map<string, AnyRow[]>();
      for (const r of sorted) {
        const tid = r.trace_id as string | null;
        if (tid) {
          const arr = byTrace.get(tid) ?? [];
          arr.push(r);
          byTrace.set(tid, arr);
        }
      }

      // Compute units: either a non-trace row unit, or a trace block unit positioned by earliest ts
      type Unit =
        | { kind: 'row'; row: AnyRow }
        | { kind: 'trace'; id: string; rows: AnyRow[]; anchor: AnyRow };
      const usedInTrace = new Set<AnyRow>();
      const traceUnits: Unit[] = [];
      for (const [id, rows] of byTrace.entries()) {
        // Anchor at the first occurrence in the current sort (Option A)
        const anchor = rows[0];
        traceUnits.push({ kind: 'trace', id, rows, anchor });
        for (const r of rows) usedInTrace.add(r);
      }
      const rowUnits: Unit[] = sorted
        .filter((r) => !usedInTrace.has(r))
        .map((r) => ({ kind: 'row', row: r }));

      // Merge units and sort using user sorts applied to the anchor/row values
      const units = [...rowUnits, ...traceUnits];
      const unitCmp = (ua: Unit, ub: Unit) => {
        const a = ua.kind === 'trace' ? ua.anchor : ua.row;
        const b = ub.kind === 'trace' ? ub.anchor : ub.row;
        return cmp(a, b);
      };
      units.sort(unitCmp);

      // Flatten, collapsing/expanding trace units according to expanded keys
      const expandedSet = new Set(req?.groupState?.expandedKeys ?? logsExpandedKeys);
      const out: AnyRow[] = [];
      for (const u of units) {
        if (u.kind === 'row') {
          out.push(u.row);
        } else {
          const key = `trace:${u.id}`;
          const isExpanded = expandedSet.has(key);
          if (isExpanded) {
            // Output all rows (already in user-sorted order). Keep the anchor row clickable.
            for (const r of u.rows) {
              out.push({
                ...r,
                __inlineGroupKey: key,
                __inlineGroupMember: r !== u.anchor,
                __inlineGroupAnchor: r === u.anchor,
                __inlineGroupExpanded: true,
                __inlineGroupSize: u.rows.length,
              });
            }
          } else {
            // Output only the anchor row, mark it as anchor
            out.push({
              ...u.anchor,
              __inlineGroupKey: key,
              __inlineGroupAnchor: true,
              __inlineGroupSize: u.rows.length,
            });
          }
        }
      }

      const len = Math.max(0, end - start);
      return { rows: out.slice(start, start + len), total: out.length };
    },
    [logsData, logsExpandedKeys, makeComparator],
  );

  // Columns for logs example
  const logsColumns: ColumnDef<LogRowWithMeta>[] = React.useMemo(() => {
    const renderIndex: ColumnDef<LogRowWithMeta>['render'] = (_v, row: LogRowWithMeta) => {
      // Row might be undefined while data is loading; treat metadata as optional
      const meta = (row ?? ({} as LogRowWithMeta)) as Partial<LogRowWithMeta>;
      const key: string | undefined = meta.__inlineGroupKey;
      const isAnchor = !!meta.__inlineGroupAnchor;
      const isMember = !!meta.__inlineGroupMember;
      const expanded = key ? logsExpandedKeys.includes(key) : false;
      const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!key) return;
        setLogsExpandedKeys((prev) => {
          const s = new Set(prev);
          if (s.has(key)) s.delete(key);
          else s.add(key);
          return Array.from(s);
        });
      };
      const arrow = isAnchor ? (expanded ? '▾' : '▸') : isMember ? '·' : '';
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {isAnchor ? (
            <button
              onClick={toggle}
              aria-label={expanded ? 'Collapse trace' : 'Expand trace'}
              type="button"
              style={{
                width: 18,
                height: 18,
                border: '1px solid var(--massive-table-border)',
                background: 'transparent',
                borderRadius: 4,
                fontSize: 11,
                lineHeight: '16px',
                padding: 0,
              }}
            >
              {arrow}
            </button>
          ) : (
            <span style={{ width: 18, display: 'inline-block' }}>{arrow}</span>
          )}
          <span>{String((row as LogRowWithMeta | undefined)?.index ?? '')}</span>
        </span>
      );
    };
    return [
      { path: ['index'], title: '#', width: 80, render: renderIndex },
      { path: ['level'], title: 'Level', width: 200 },
      { path: ['message'], title: 'Message' },
      { path: ['trace_id'], title: 'Trace ID', inlineGroup: true },
    ];
  }, [logsExpandedKeys]);

  // Storybook-like example registry
  type Variant = {
    name: string;
    props: Partial<React.ComponentProps<typeof MassiveTable<Row | GroupHeader>>>;
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
        key: 'logs',
        title: 'Logs (inline group)',
        variants: [
          {
            name: 'Trace collapse/expand by Trace ID',
            props: {
              columns: logsColumns as unknown as ColumnDef<Row | GroupHeader>[],
              getRows: getRowsLogs as unknown as (
                start: number,
                end: number,
                req?: RowsRequest<Row | GroupHeader>,
              ) => GetRowsResult<Row | GroupHeader>,
              rowCount: logsData.length,
              enableSort: true,
              defaultSorts: [{ path: ['index'], dir: 'desc' }] as unknown as Sort[],
              expandedKeys: logsExpandedKeys,
              onExpandedKeysChange: setLogsExpandedKeys,
            },
            note: '30 logs; traces inlined under the first occurrence.',
          },
          {
            name: 'Inline group + Index Asc',
            props: {
              columns: logsColumns as unknown as ColumnDef<Row | GroupHeader>[],
              getRows: getRowsLogs as unknown as (
                start: number,
                end: number,
                req?: RowsRequest<Row | GroupHeader>,
              ) => GetRowsResult<Row | GroupHeader>,
              rowCount: logsData.length,
              enableSort: true,
              defaultSorts: [{ path: ['index'], dir: 'asc' }] as unknown as Sort[],
              expandedKeys: logsExpandedKeys,
              onExpandedKeysChange: setLogsExpandedKeys,
            },
            note: 'Same data but sorted by index ascending by default.',
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
    [logsColumns, getRowsLogs, logsData.length, logsExpandedKeys],
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
          <h1 style={{ margin: 0, fontSize: 18 }}>MassiveTable Examples</h1>
          {activeExample.key === 'reorder' && (
            <span style={{ color: '#555' }}>
              {previewOrder
                ? `Preview order: ${previewOrder.join(', ')}`
                : `Final order: ${order.join(', ') || '(default)'}`}
            </span>
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
          <MassiveTable<Row | GroupHeader>
            key={`${activeExample.key}:${activeVariantIndex}`}
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
