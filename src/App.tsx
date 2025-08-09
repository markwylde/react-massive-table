import Chance from 'chance';
import * as React from 'react';
import Tabletron from './lib/Tabletron';
import type { ColumnDef, ColumnPath, GetRowsResult, RowsRequest } from './lib/types';
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
  const [order, setOrder] = React.useState<number[]>([]);
  const [previewOrder, setPreviewOrder] = React.useState<number[] | null>(null);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: 16,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Tabletron Demo</h1>
          {previewOrder ? (
            <p style={{ margin: 0, color: '#555' }}>Preview order: {previewOrder.join(', ')}</p>
          ) : (
            <p style={{ margin: 0, color: '#555' }}>
              Final order: {order.join(', ') || '(default)'}
            </p>
          )}
          <p style={{ margin: 0, color: '#555' }}>Shift+click headers to multi-sort.</p>
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
      <div style={{ flex: 1, padding: 16, paddingTop: 0 }}>
        <Tabletron<Row | GroupHeader>
          getRows={getRows}
          rowCount={rowCount}
          columns={columns}
          mode={mode}
          onColumnOrderPreviewChange={(o) => setPreviewOrder(o)}
          onColumnOrderChange={(o) => {
            setOrder(o);
            setPreviewOrder(null);
          }}
          style={{ height: '80vh', width: '100%' }}
        />
      </div>
    </div>
  );
}
