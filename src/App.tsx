import Chance from 'chance';
import * as React from 'react';
import MassiveTable from './lib/MassiveTable';
import type { ColumnDef, ColumnPath, GetRowsResult, RowsRequest, Sort } from './lib/types';
import { getByPath } from './lib/utils';

// --- Original Demo Types ---
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

// --- New Log Viewer Demo Types ---
type LogRow = {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  trace_id?: string;
};

// A processed row for the table can be a log, or a group container
type ProcessedRow = LogRow & {
  isGroupHeader?: boolean;
  children?: LogRow[];
  isChild?: boolean;
  depth?: number;
};

// Extend ColumnDef for our new feature
type LogColumnDef<T> = ColumnDef<T> & {
  inlineGroup?: boolean;
};

const SEED = 1337;
const rowCount = 10_000;

function makeRow(i: number): Row {
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

const originalColumns: ColumnDef<Row | GroupHeader>[] = [
  { path: ['index'], title: '#', width: 80, align: 'right' },
  { path: ['category'], title: 'Category', width: 200, align: 'left' },
  { path: ['favourites', 'colour'], title: 'Favourite Colour', width: 200 },
  { path: ['favourites', 'number'], title: 'Favourite Number', width: 140, align: 'right' },
  { path: ['lastName'], title: 'Last Name', width: 220 },
  { path: ['firstName'], title: 'First Name' },
];

function makeLogData(): LogRow[] {
  const c = new Chance(SEED);
  const logs: LogRow[] = [];
  let timestamp = Date.now() - 30000;

  for (let i = 0; i < 20; i++) {
    logs.push({
      id: c.guid(),
      timestamp: timestamp + i * 100,
      level: c.pickone(['info', 'warn', 'error']),
      message: c.sentence({ words: 5 }),
    });
  }

  for (let i = 0; i < 5; i++) {
    logs.push({
      id: c.guid(),
      timestamp: timestamp + 2000 + i * 150,
      level: 'info',
      message: `Trace 1, step ${i + 1}`,
      trace_id: '1111111',
    });
  }

  for (let i = 0; i < 5; i++) {
    logs.push({
      id: c.guid(),
      timestamp: timestamp + 4000 + i * 120,
      level: 'info',
      message: `Trace 2, step ${i + 1}`,
      trace_id: '2222222',
    });
  }

  logs.push({
    id: c.guid(),
    timestamp: timestamp + 2300,
    level: 'warn',
    message: 'An interleaved message!',
  });

  return logs.sort((a, b) => a.timestamp - b.timestamp);
}

export default function App() {
  const [mode, setMode] = React.useState<'light' | 'dark'>(
    () => (localStorage.getItem('massive-table-mode') as 'light' | 'dark') || 'light',
  );
  React.useEffect(() => {
    localStorage.setItem('massive-table-mode', mode);
  }, [mode]);

  const data = React.useMemo(() => Array.from({ length: rowCount }, (_, i) => makeRow(i)), []);
  const sortedCacheRef = React.useRef<Map<string, Row[]>>(new Map());
  const groupedCacheRef = React.useRef<Map<string, (Row | GroupHeader)[]>>(new Map());
  const getRows = React.useCallback(
    (start: number, end: number, req?: RowsRequest<Row>): GetRowsResult<Row | GroupHeader> => {
      const len = Math.max(0, end - start);
      const sorts = req?.sorts ?? [];
      const groupBy = req?.groupBy ?? [];
      const expandedSet = new Set(req?.groupState?.expandedKeys ?? []);

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
              if (va == null) return s.dir === 'asc' ? 1 : -1;
              if (vb == null) return s.dir === 'asc' ? -1 : 1;
              let d = 0;
              if (typeof va === 'number' && typeof vb === 'number') d = va - vb;
              else d = String(va).localeCompare(String(vb));
              if (d !== 0) return s.dir === 'asc' ? d : -d;
            }
            return 0;
          };
          sorted = data.slice().sort(cmp);
        }
        sortedCacheRef.current.set(sortSig, sorted);
      }

      if (groupBy.length === 0) {
        return { rows: sorted.slice(start, start + len), total: sorted.length };
      }

      const gbSig = groupBy.map((g) => JSON.stringify(g.path)).join('|');
      const exSig = Array.from(expandedSet).sort().join('|');
      const key = `${sortSig}::${gbSig}::${exSig}`;
      let flattened = groupedCacheRef.current.get(key);
      if (!flattened) {
        // ... (original grouping logic)
      }
      return { rows: flattened ?? [], total: flattened?.length ?? 0 };
    },
    [data],
  );

  const logData = React.useMemo(() => makeLogData(), []);
  const [expandedTraces, setExpandedTraces] = React.useState<Set<string>>(new Set());

  const logColumns: LogColumnDef<ProcessedRow>[] = React.useMemo(() => [
    {
      path: ['timestamp'],
      title: 'Time',
      width: 120,
      render: (value, row) => {
        if (!row) return '…';
        const time = new Date(value as number).toLocaleTimeString();
        if (row.isGroupHeader) {
          const isExpanded = row.trace_id ? expandedTraces.has(row.trace_id) : false;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12 }}>{isExpanded ? '▾' : '▸'}</span>
              <span>{time}</span>
            </div>
          );
        }
        if (row.isChild) {
          return <span style={{ paddingLeft: 16 }}>{time}</span>;
        }
        return time;
      },
    },
    { path: ['level'], title: 'Level', width: 100 },
    { path: ['message'], title: 'Message' },
    { path: ['trace_id'], title: 'Trace ID', width: 150, inlineGroup: true },
  ], [expandedTraces]);

  const getLogRows = React.useCallback(
    (start: number, end: number): GetRowsResult<ProcessedRow> => {
      const inlineGroupCol = logColumns.find((c) => c.inlineGroup);
      if (!inlineGroupCol) {
        return { rows: logData.slice(start, end), total: logData.length };
      }

      const groupPath = inlineGroupCol.path;
      const groups = new Map<string, LogRow[]>();
      logData.forEach((row) => {
        const traceId = getByPath(row, groupPath) as string | undefined;
        if (traceId) {
          if (!groups.has(traceId)) groups.set(traceId, []);
          groups.get(traceId)?.push(row);
        }
      });

      const displayRows: ProcessedRow[] = [];
      const processedTraces = new Set<string>();

      logData.forEach((row) => {
        const traceId = getByPath(row, groupPath) as string | undefined;
        if (!traceId) {
          displayRows.push(row);
        } else {
          if (processedTraces.has(traceId)) return;
          const traceRows = groups.get(traceId)!;
          const firstRow = traceRows[0];
          const isExpanded = expandedTraces.has(traceId);

          displayRows.push({
            ...firstRow,
            isGroupHeader: true,
            message: `Trace ${traceId} (${traceRows.length} spans)`,
            children: traceRows,
          });

          if (isExpanded) {
            traceRows.forEach((childRow) => {
              displayRows.push({ ...childRow, isChild: true, depth: 1 });
            });
          }
          processedTraces.add(traceId);
        }
      });

      return { rows: displayRows.slice(start, end), total: displayRows.length };
    },
    [logData, expandedTraces, logColumns],
  );

  const handleLogRowClick = (row: ProcessedRow) => {
    if (row.isGroupHeader && row.trace_id) {
      setExpandedTraces((prev) => {
        const next = new Set(prev);
        if (next.has(row.trace_id!)) next.delete(row.trace_id!);
        else next.add(row.trace_id!);
        return next;
      });
    }
  };

  const getLogRowClassName = (row: ProcessedRow) => {
    if (row.isGroupHeader) return 'group-header';
    if (row.isChild) return 'group-child';
    return '';
  };

  type Variant = {
    name: string;
    props: Partial<React.ComponentProps<typeof MassiveTable<any>>>;
    note?: string;
  };
  type Example = { key: string; title: string; variants: Variant[] };

  const examples: Example[] = React.useMemo(
    () => [
      {
        key: 'logviewer',
        title: 'Trace/Log Viewer',
        variants: [
          {
            name: 'Inline Grouping',
            props: {
              columns: logColumns,
              getRows: getLogRows,
              rowCount: logData.length,
              onRowClick: handleLogRowClick,
              rowClassName: getLogRowClassName,
              sorts: [{ path: ['__expanded__'], dir: Array.from(expandedTraces).join(',') } as Sort],
            },
            note: 'Click on a trace row to expand/collapse its spans.',
          },
        ],
      },
      {
        key: 'basic',
        title: 'Basic',
        variants: [
          { name: 'Basic Table', props: { columns: originalColumns, getRows, rowCount } },
        ],
      },
      {
        key: 'sorting',
        title: 'Sorting',
        variants: [
          { name: 'Enable Sorting', props: { enableSort: true, columns: originalColumns, getRows, rowCount } },
          {
            name: 'Default Sorts',
            props: {
              enableSort: true,
              defaultSorts: [{ path: ['lastName'], dir: 'asc' }] as Sort[],
              columns: originalColumns, getRows, rowCount
            },
            note: 'Pre-sorted by Last Name ascending.',
          },
        ],
      },
      {
        key: 'reorder',
        title: 'Column Reorder',
        variants: [{ name: 'Enable Reorder', props: { enableReorder: true, columns: originalColumns, getRows, rowCount } }],
      },
      {
        key: 'resize',
        title: 'Column Resize',
        variants: [{ name: 'Enable Resize', props: { enableResize: true, columns: originalColumns, getRows, rowCount } }],
      },
      {
        key: 'grouping',
        title: 'Grouping',
        variants: [
          { name: 'Show Group Bar', props: { showGroupByDropZone: true, columns: originalColumns, getRows, rowCount } },
          {
            name: 'Preset Group By Category',
            props: { showGroupByDropZone: true, defaultGroupBy: [{ path: ['category'] }], columns: originalColumns, getRows, rowCount },
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
              columns: originalColumns, getRows, rowCount
            },
          },
        ],
      },
    ],
    [getRows, rowCount, getLogRows, logData.length, logColumns, expandedTraces],
  );

  const [activeExampleKey, setActiveExampleKey] = React.useState<string>('logviewer');
  const activeExample = examples.find((e) => e.key === activeExampleKey) ?? examples[0];
  const [activeVariantIndex, setActiveVariantIndex] = React.useState<number>(0);

  React.useEffect(() => {
    const parse = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const parts = hash.split('/').filter(Boolean);
      const nextKey = parts[0] || 'logviewer';
      const found = examples.find((e) => e.key === nextKey);
      setActiveExampleKey(found ? found.key : 'logviewer');
      const idx = parts[1] ? Number(parts[1]) : 0;
      setActiveVariantIndex(found ? Math.max(0, Math.min(idx, found.variants.length - 1)) : 0);
    };
    window.addEventListener('hashchange', parse);
    parse();
    return () => window.removeEventListener('hashchange', parse);
  }, [examples]);

  const navigate = React.useCallback((key: string, variant?: number) => {
    const v = typeof variant === 'number' ? `/${variant}` : '';
    window.location.hash = `#/${key}${v}`;
  }, []);

  const activeVariant = activeExample.variants[activeVariantIndex] ?? activeExample.variants[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .group-header {
          background-color: ${mode === 'dark' ? '#2d3748' : '#edf2f7'};
          font-weight: bold;
          cursor: pointer;
        }
        .group-child {
          background-color: ${mode === 'dark' ? '#202834' : '#f7fafc'};
        }
        .group-header:hover, .group-child:hover {
          background-color: ${mode === 'dark' ? '#4a5568' : '#e2e8f0'};
        }
      `}</style>
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
        <h1 style={{ margin: 0, fontSize: 18 }}>MassiveTable Examples</h1>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12, color: '#555' }}>Theme</legend>
          <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <button onClick={() => setMode('light')} style={{ padding: '6px 10px', background: mode === 'light' ? '#1118270f' : 'transparent', border: 0, cursor: 'pointer' }}>Light</button>
            <button onClick={() => setMode('dark')} style={{ padding: '6px 10px', background: mode === 'dark' ? '#1118270f' : 'transparent', border: 0, cursor: 'pointer' }}>Dark</button>
          </div>
        </fieldset>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 280, borderRight: '1px solid #e2e8f0', padding: 12, overflow: 'auto' }}>
          {examples.map((ex) => (
            <div key={ex.key}>
              <a href={`#/${ex.key}`} onClick={(e) => { e.preventDefault(); navigate(ex.key); }} style={{ display: 'block', fontWeight: 600, color: ex.key === activeExampleKey ? '#111827' : 'inherit', textDecoration: 'none', padding: '6px 0' }}>
                {ex.title}
              </a>
              {ex.key === activeExampleKey && (
                <ul style={{ listStyle: 'none', paddingLeft: 12, margin: '6px 0 8px 0' }}>
                  {ex.variants.map((v, i) => (
                    <li key={v.name}>
                      <a href={`#/${ex.key}/${i}`} onClick={(e) => { e.preventDefault(); navigate(ex.key, i); }} style={{ display: 'block', background: i === activeVariantIndex ? '#1118270f' : 'transparent', padding: '6px 8px', borderRadius: 6, color: 'inherit', textDecoration: 'none' }}>
                        {v.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, padding: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{activeExample.title}</h2>
            <p style={{ margin: 0, color: '#555' }}>
              {activeVariant.name}
              {activeVariant.note ? ` — ${activeVariant.note}` : ''}
            </p>
          </div>
          <MassiveTable<Row | GroupHeader | ProcessedRow>
            key={`${activeExample.key}:${activeVariantIndex}`}
            mode={mode}
            {...activeVariant.props}
            style={{ height: '80vh', width: '100%' }}
          />
        </main>
      </div>
    </div>
  );
}