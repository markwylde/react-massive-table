import * as React from 'react';
import MassiveTable from '../lib/MassiveTable';
import type {
  ColumnDef,
  GetRowsResult,
  RowsRequest,
  Sort,
} from '../lib/types';
import { getByPath } from '../lib/utils';
import type { Row, GroupHeader } from '../demoTypes';

interface Props {
  className: string;
  classes: Record<string, string>;
  defaultSortDir: 'asc' | 'desc';
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type LogRow = {
  id: number;
  ts: number;
  level: LogLevel;
  message: string;
  trace_id: string | null;
  index: number;
};

type LogRowWithMeta = LogRow & {
  __inlineGroupKey?: string;
  __inlineGroupAnchor?: boolean;
  __inlineGroupMember?: boolean;
  __inlineGroupExpanded?: boolean;
  __inlineGroupSize?: number;
};

function buildLogs(): LogRow[] {
  const base = Date.now() - 1000 * 60 * 60;
  const total = 30;
  const traceAidx = [3, 6, 12, 18, 24];
  const traceBidx = [5, 11, 15, 21, 27];
  const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
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

export default function LogsPage({ className, classes, defaultSortDir }: Props) {
  const logsData = React.useMemo(() => buildLogs(), []);
  const [expandedKeys, setExpandedKeys] = React.useState<string[]>([]);

  const logsColumns: ColumnDef<LogRowWithMeta>[] = React.useMemo(
    () => [
      { path: ['index'], title: '#', width: 80 },
      { path: ['level'], title: 'Level', width: 200 },
      { path: ['message'], title: 'Message' },
      { path: ['trace_id'], title: 'Trace ID', inlineGroup: true },
    ],
    [],
  );

  const makeComparator = React.useCallback(
    <T extends object>(sorts: Sort<T>[]) =>
      (a: T, b: T) => {
        for (const s of sorts) {
          const va = getByPath(a as Record<string, unknown>, s.path);
          const vb = getByPath(b as Record<string, unknown>, s.path);
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
        sorts.length > 0 ? sorts : ([{ path: ['index'], dir: defaultSortDir }] as Sort<AnyRow>[]);
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

      type Unit = { kind: 'row'; row: AnyRow } | { kind: 'trace'; id: string; rows: AnyRow[]; anchor: AnyRow };
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

      const expandedSet = new Set(req?.groupState?.expandedKeys ?? expandedKeys);
      const out: AnyRow[] = [];
      for (const u of units) {
        if (u.kind === 'row') {
          out.push(u.row);
        } else {
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
    [logsData, expandedKeys, defaultSortDir, makeComparator],
  );

  return (
    <MassiveTable<AnyRow>
      columns={logsColumns as unknown as ColumnDef<Row | GroupHeader>[]}
      getRows={getRowsLogs as unknown as (
        start: number,
        end: number,
        req?: RowsRequest<Row | GroupHeader>,
      ) => Promise<GetRowsResult<Row | GroupHeader>>}
      rowCount={logsData.length}
      enableSort
      defaultSorts={[{ path: ['index'], dir: defaultSortDir }] as unknown as Sort[]}
      expandedKeys={expandedKeys}
      onExpandedKeysChange={setExpandedKeys}
      className={className}
      classes={classes}
    />
  );
}
