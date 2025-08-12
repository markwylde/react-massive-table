import Chance from 'chance';
import * as React from 'react';
import { columns as baseColumns } from '../demo/columns';
import type { GroupHeader, LogRow, Row } from '../demo/types';
import baseClasses from '../lib/styles/base.module.css';
import darkTheme from '../lib/styles/dark.module.css';
import lightTheme from '../lib/styles/light.module.css';
import type { ColumnDef, GetRowsResult, RowsRequest, Sort } from '../lib/types';
import { getByPath } from '../lib/utils';

const SEED = 1337;
const DEFAULT_ROW_COUNT = 10_000;

export type DemoContextValue = {
  // theme
  mode: 'light' | 'dark';
  setMode: (m: 'light' | 'dark') => void;
  themeClass: string;
  baseClasses: typeof baseClasses;

  // data
  rowCount: number;
  isGenerating: boolean;
  setRowCount: (n: number) => void;
  startGeneration: (n: number) => void;
  data: Row[];
  dataVersion: number;
  columns: ColumnDef<Row | GroupHeader>[];
  getRows: (
    start: number,
    end: number,
    req?: RowsRequest<Row | GroupHeader>,
  ) => Promise<GetRowsResult<Row | GroupHeader>>;

  // logs example
  logsData: LogRow[];
  logsColumns: ColumnDef<(LogRow & Record<string, unknown>) | GroupHeader>[];
  getRowsLogs: (
    start: number,
    end: number,
    req?: RowsRequest<Record<string, unknown>>,
  ) => Promise<GetRowsResult<Record<string, unknown>>>;
  logsExpandedKeys: string[];
  setLogsExpandedKeys: React.Dispatch<React.SetStateAction<string[]>>;
};

const DemoContext = React.createContext<DemoContextValue | null>(null);

function buildLogs(): LogRow[] {
  const base = Date.now() - 1000 * 60 * 60;
  const total = 30;
  const traceAidx = [3, 6, 12, 18, 24];
  const traceBidx = [5, 11, 15, 21, 27];
  const levels: LogRow['level'][] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const rows: LogRow[] = [];
  let id = 1;
  for (let i = 0; i < total; i++) {
    const ts = base + i * 60_000;
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

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // theme
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
    try {
      localStorage.setItem('massive-table-mode', mode);
    } catch {}
    try {
      const root = document.documentElement;
      root.setAttribute('data-theme', mode);
      document.body?.setAttribute('data-theme', mode);
    } catch {}
  }, [mode]);
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
      mql.addListener?.(handler);
    }
    return () => {
      try {
        mql.removeEventListener('change', handler);
      } catch {
        mql.removeListener?.(handler);
      }
    };
  }, []);

  // data
  const [rowCount, setRowCount] = React.useState<number>(DEFAULT_ROW_COUNT);
  const [data, setData] = React.useState<Row[]>([]);
  const [dataVersion, setDataVersion] = React.useState<number>(0);
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const workerRef = React.useRef<Worker | null>(null);

  const generateRowsSync = React.useCallback((count: number): Row[] => {
    const rows: Row[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const c = new Chance(`${SEED}-${i}`);
      rows[i] = {
        index: i + 1,
        firstName: c.first(),
        lastName: c.last(),
        category: c.pick(['one', 'two', null]) as Row['category'],
        favourites: {
          colour: c.color({ format: 'name' }),
          number: c.integer({ min: 1, max: 100 }),
        },
      };
    }
    return rows;
  }, []);

  const startGeneration = React.useCallback(
    (count: number) => {
      setIsGenerating(true);
      setRowCount(count);
      try {
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
      } catch {}
      if (typeof Worker === 'undefined') {
        const rows = generateRowsSync(count);
        setData(rows);
        setDataVersion((v) => v + 1);
        setIsGenerating(false);
        return;
      }
      try {
        const w = new Worker(new URL('../dataWorker.ts', import.meta.url), { type: 'module' });
        workerRef.current = w;
        w.onmessage = (ev: MessageEvent<{ type: string; rows: Row[] }>) => {
          if (ev.data?.type === 'generated') {
            setData(ev.data.rows);
            setDataVersion((v) => v + 1);
            setIsGenerating(false);
          }
        };
        w.postMessage({ type: 'generate', count, seed: SEED });
      } catch {
        const rows = generateRowsSync(count);
        setData(rows);
        setDataVersion((v) => v + 1);
        setIsGenerating(false);
      }
    },
    [generateRowsSync],
  );

  React.useEffect(() => {
    startGeneration(DEFAULT_ROW_COUNT);
    return () => {
      try {
        workerRef.current?.terminate();
      } catch {}
    };
  }, [startGeneration]);

  const sortedCacheRef = React.useRef<Map<string, Row[]>>(new Map());
  const groupedCacheRef = React.useRef<Map<string, (Row | GroupHeader)[]>>(new Map());
  React.useEffect(() => {
    sortedCacheRef.current.clear();
    groupedCacheRef.current.clear();
  }, [data]);

  const getRows = React.useCallback(
    async (
      start: number,
      end: number,
      req?: RowsRequest<Row | GroupHeader>,
    ): Promise<GetRowsResult<Row | GroupHeader>> => {
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

      if (groupBy.length === 0) {
        return { rows: sorted.slice(start, start + len), total: sorted.length };
      }

      const gbSig = groupBy.map((g) => JSON.stringify(g.path)).join('|');
      const exSig = Array.from(expandedSet).sort().join('|');
      const key = `${sortSig}::${gbSig}::${exSig}`;
      let flattened = groupedCacheRef.current.get(key);
      if (!flattened) {
        const paths = groupBy.map((g) => g.path);
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

  // logs helpers
  const logsData = React.useMemo(() => buildLogs(), []);
  const [logsExpandedKeys, setLogsExpandedKeys] = React.useState<string[]>([]);
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
    async (
      start: number,
      end: number,
      req?: RowsRequest<AnyRow>,
    ): Promise<GetRowsResult<AnyRow>> => {
      const sorts = (req?.sorts as Sort<AnyRow>[]) ?? [];
      const effectiveSorts =
        sorts.length > 0 ? sorts : ([{ path: ['index'], dir: 'desc' }] as Sort<AnyRow>[]);
      const cmp = makeComparator<AnyRow>(effectiveSorts);

      const sorted = logsData
        .map((r) => r as AnyRow)
        .slice()
        .sort(cmp);

      const byTrace = new Map<string, AnyRow[]>();
      for (const r of sorted) {
        const tid = r.trace_id as string | null;
        if (tid) {
          const arr = byTrace.get(tid) ?? [];
          arr.push(r);
          byTrace.set(tid, arr);
        }
      }

      type Unit =
        | { kind: 'row'; row: AnyRow }
        | { kind: 'trace'; id: string; rows: AnyRow[]; anchor: AnyRow };
      const usedInTrace = new Set<AnyRow>();
      const traceUnits: Unit[] = [];
      for (const [id, rows] of byTrace.entries()) {
        const anchor = rows[0];
        traceUnits.push({ kind: 'trace', id, rows, anchor });
        for (const r of rows) usedInTrace.add(r);
      }
      const rowUnits: Unit[] = sorted
        .filter((r) => !usedInTrace.has(r))
        .map((r) => ({ kind: 'row', row: r }));

      const units = [...rowUnits, ...traceUnits];
      const unitCmp = (ua: Unit, ub: Unit) => {
        const a = ua.kind === 'trace' ? ua.anchor : ua.row;
        const b = ub.kind === 'trace' ? ub.anchor : ub.row;
        return cmp(a, b);
      };
      units.sort(unitCmp);

      const expandedSet = new Set(req?.groupState?.expandedKeys ?? logsExpandedKeys);
      const out: AnyRow[] = [];
      for (const u of units) {
        if (u.kind === 'row') out.push(u.row);
        else {
          const key = `trace:${u.id}`;
          const isExpanded = expandedSet.has(key);
          if (isExpanded) {
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

  const logsColumns = React.useMemo(
    () =>
      [
        { path: ['index'], title: '#', width: 80 },
        { path: ['level'], title: 'Level', width: 200 },
        { path: ['message'], title: 'Message' },
        { path: ['trace_id'], title: 'Trace ID', inlineGroup: true },
      ] as ColumnDef<(LogRow & Record<string, unknown>) | GroupHeader>[],
    [],
  );

  const themeClass = mode === 'dark' ? darkTheme.theme : lightTheme.theme;

  const value: DemoContextValue = {
    mode,
    setMode,
    themeClass,
    baseClasses,
    rowCount,
    isGenerating,
    setRowCount,
    startGeneration,
    data,
    dataVersion,
    columns: baseColumns,
    getRows,
    logsData,
    logsColumns,
    getRowsLogs,
    logsExpandedKeys,
    setLogsExpandedKeys,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export function useDemo() {
  const ctx = React.useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
}
