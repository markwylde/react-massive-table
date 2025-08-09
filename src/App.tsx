import Chance from 'chance';
import Prism from 'prismjs';
import * as React from 'react';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import MassiveTable from './lib/MassiveTable';
import baseClasses from './lib/styles/base.module.css';
import darkTheme from './lib/styles/dark.module.css';
import lightTheme from './lib/styles/light.module.css';
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
  const [mode, setMode] = React.useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('massive-table-mode') as 'light' | 'dark' | null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    try {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
      return prefersDark ? 'dark' : 'light';
    } catch {}
    return 'light';
  });
  React.useEffect(() => {
    // Persist and apply theme at the document level so global CSS vars resolve
    try {
      localStorage.setItem('massive-table-mode', mode);
    } catch {}
    try {
      const root = document.documentElement;
      root.setAttribute('data-theme', mode);
      // Also mirror on body (defensive in case of component portals)
      document.body?.setAttribute('data-theme', mode);
    } catch {}
  }, [mode]);

  // If the user hasn't explicitly chosen a theme, follow system changes
  React.useEffect(() => {
    let hasSaved = false;
    try {
      hasSaved = !!localStorage.getItem('massive-table-mode');
    } catch {}
    if (hasSaved) return;
    const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (!mql) return;
    const handler = (ev: MediaQueryListEvent) => setMode(ev.matches ? 'dark' : 'light');
    try {
      mql.addEventListener('change', handler);
    } catch {
      // Safari <14 legacy API
      mql.addListener?.(handler);
    }
    return () => {
      try {
        mql.removeEventListener('change', handler);
      } catch {
        // Safari <14 legacy API
        mql.removeListener?.(handler);
      }
    };
  }, []);
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
  const logsColumns: ColumnDef<LogRowWithMeta>[] = React.useMemo(
    () => [
      { path: ['index'], title: '#', width: 80 },
      { path: ['level'], title: 'Level', width: 200 },
      { path: ['message'], title: 'Message' },
      { path: ['trace_id'], title: 'Trace ID', inlineGroup: true },
    ],
    [],
  );

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
        key: 'custom',
        title: 'Custom Render',
        variants: [
          {
            name: 'Red pill cell',
            props: {
              columns: (() => {
                const pillColumns: ColumnDef<Row | GroupHeader>[] = columns.map((c) => ({ ...c }));
                // Add a render override to show a red pill for a specific cell
                const idx = pillColumns.findIndex(
                  (c) => JSON.stringify(c.path) === JSON.stringify(['favourites', 'number']),
                );
                if (idx >= 0) {
                  pillColumns[idx] = {
                    ...pillColumns[idx],
                    render: (v: unknown, row: Row | GroupHeader, rowIndex: number) => {
                      const isGroupHeader = (r: Row | GroupHeader): r is GroupHeader =>
                        '__group' in r;
                      // Only decorate one specific cell in this demo: rowIndex === 10
                      if (rowIndex === 10 && row && !isGroupHeader(row) && typeof v === 'number') {
                        return (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: 999,
                                padding: '2px 8px',
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              {String(v)}
                            </span>
                          </span>
                        );
                      }
                      // default rendering
                      return String(v ?? '');
                    },
                  } as ColumnDef<Row | GroupHeader>;
                }
                return pillColumns;
              })() as ColumnDef<Row | GroupHeader>[],
            },
            note: 'Shows a red pill for one specific cell using a column render override.',
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

  // Helper: build a concise usage snippet per variant
  const usageCode = React.useMemo(() => {
    const v = activeVariant;
    const isLogs = activeExample.key === 'logs';
    const baseHeader = `import MassiveTable from 'react-massive-table';\n`;
    const baseRow = isLogs
      ? `type Row = { id: number; ts: number; level: 'DEBUG'|'INFO'|'WARN'|'ERROR'; message: string; trace_id?: string|null; index: number };\n`
      : `type Row = { index: number; firstName: string; lastName: string; category: 'one'|'two'|null; favourites: { colour: string; number: number } };\n`;
    const cols = isLogs
      ? `const columns: ColumnDef<Row>[] = [\n  { path: ['index'], title: '#', width: 80 },\n  { path: ['level'], title: 'Level', width: 200 },\n  { path: ['message'], title: 'Message' },\n  { path: ['trace_id'], title: 'Trace ID', inlineGroup: true },\n];\n`
      : `const columns: ColumnDef<Row>[] = [\n  { path: ['index'], title: '#', width: 80, align: 'right' },\n  { path: ['category'], title: 'Category', width: 200 },\n  { path: ['favourites','colour'], title: 'Favourite Colour', width: 200 },\n  { path: ['favourites','number'], title: 'Favourite Number', width: 140, align: 'right' },\n  { path: ['lastName'], title: 'Last Name', width: 220 },\n  { path: ['firstName'], title: 'First Name' },\n];\n`;
    const getRowsSig = isLogs
      ? `// See demo source for inline-grouping by trace\nconst getRows = (start: number, end: number, req?: RowsRequest<Row>) => {/* ... */};\n`
      : `// Provide rows for the visible window\nconst getRows = (start: number, end: number, req?: RowsRequest<Row>) => {/* ... */};\n`;
    const props: string[] = [];
    // Always include core props
    if (isLogs) {
      props.push('columns={columns}');
      props.push('getRows={getRows}');
      props.push(`rowCount={${isLogs ? 'logs.length' : 'rowCount'}}`);
    } else {
      props.push('columns={columns}');
      props.push('getRows={getRows}');
      props.push('rowCount={rowCount}');
    }
    // Variant props
    type VariantPropsExtras = {
      defaultSorts?: Sort[];
      defaultGroupBy?: { path: ColumnPath }[];
      rowHeight?: unknown;
    };
    const p = (v.props ?? {}) as Partial<
      React.ComponentProps<typeof MassiveTable<Row | GroupHeader>>
    > &
      VariantPropsExtras;
    if (p.enableSort) props.push('enableSort');
    if (p.enableReorder) props.push('enableReorder');
    if (p.enableResize) props.push('enableResize');
    if (p.showGroupByDropZone) props.push('showGroupByDropZone');
    if (p.defaultSorts) {
      const ds = p.defaultSorts as Sort[];
      props.push(
        `defaultSorts={[${ds
          .map((s) => `{ path: ${JSON.stringify(s.path)}, dir: '${s.dir}' }`)
          .join(', ')}]}`,
      );
    }
    if (p.defaultGroupBy) {
      const dg = p.defaultGroupBy as { path: ColumnPath }[];
      props.push(
        `defaultGroupBy={[${dg.map((g) => `{ path: ${JSON.stringify(g.path)} }`).join(', ')}]}`,
      );
    }
    if (p.rowHeight !== undefined) props.push(`rowHeight={${JSON.stringify(p.rowHeight)}}`);

    const open = `<MassiveTable<Row>\n  `;
    const body = props.map((line) => `  ${line}`).join('\n');
    const close = `\n/>`;
    return [
      baseHeader,
      baseRow,
      `/* Columns */\n${cols}`,
      `/* Data fetching */\n${getRowsSig}`,
      `/* Usage */\n${open}${body}${close}`,
    ].join('\n');
  }, [activeExample.key, activeVariant]);

  const copyUsage = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(usageCode);
    } catch {}
  }, [usageCode]);
  const usageHtml = React.useMemo(
    () => Prism.highlight(usageCode, Prism.languages.tsx, 'tsx'),
    [usageCode],
  );
  const usageCodeRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (usageCodeRef.current) {
      usageCodeRef.current.innerHTML = usageHtml;
    }
  }, [usageHtml]);

  return (
    <div className="app" data-theme={mode}>
      {/* Top bar */}
      <div className="topbar">
        <div className="brand">
          <h1>MassiveTable Examples</h1>
          {activeExample.key === 'reorder' && (
            <span className="subtle">
              {previewOrder
                ? `Preview order: ${previewOrder.join(', ')}`
                : `Final order: ${order.join(', ') || '(default)'}`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="subtle">Theme</span>
          <fieldset className="segmented" aria-label="Theme toggle">
            <button
              onClick={() => setMode('light')}
              type="button"
              className={mode === 'light' ? 'active' : undefined}
              aria-pressed={mode === 'light'}
            >
              Light
            </button>
            <button
              onClick={() => setMode('dark')}
              type="button"
              className={mode === 'dark' ? 'active' : undefined}
              aria-pressed={mode === 'dark'}
            >
              Dark
            </button>
          </fieldset>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="shell">
        {/* Sidebar */}
        <aside className="sidebar">
          {examples.map((ex) => (
            <div key={ex.key} className="nav-group">
              <a
                href={`#/${ex.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(ex.key);
                }}
                className={ex.key === activeExampleKey ? 'nav-title active' : 'nav-title'}
              >
                {ex.title}
              </a>
              {ex.key === activeExampleKey && (
                <ul className="variants">
                  {ex.variants.map((v, i) => (
                    <li key={v.name}>
                      <a
                        href={`#/${ex.key}/${i}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(ex.key, i);
                        }}
                        className={i === activeVariantIndex ? 'active' : undefined}
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
        <main className="main">
          <div style={{ marginBottom: 10 }}>
            <h2 className="heading">{activeExample.title}</h2>
            <p className="note">
              {activeVariant.name}
              {activeVariant.note ? ` — ${activeVariant.note}` : ''}
            </p>
          </div>
          <MassiveTable<Row | GroupHeader>
            key={`${activeExample.key}:${activeVariantIndex}`}
            getRows={getRows}
            rowCount={rowCount}
            columns={columns}
            classes={baseClasses}
            className={mode === 'dark' ? darkTheme.theme : lightTheme.theme}
            {...activeVariant.props}
            onColumnOrderPreviewChange={(o) => setPreviewOrder(o)}
            onColumnOrderChange={(o) => {
              setOrder(o);
              setPreviewOrder(null);
            }}
            style={{ height: '70vh', width: '100%' }}
          />

          {/* Usage panel */}
          <section className="usage" aria-label="Usage code">
            <div className="usage-head">
              <h3 className="usage-title">Usage</h3>
              <div className="usage-actions">
                <button className="ghost-btn" type="button" onClick={copyUsage}>
                  Copy
                </button>
              </div>
            </div>
            <pre className="code">
              <code ref={usageCodeRef} />
            </pre>
          </section>
        </main>
      </div>
    </div>
  );
}
