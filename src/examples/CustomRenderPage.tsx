import * as React from 'react';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef, GetRowsResult, RowsRequest } from '../lib/types';
import type { Row, GroupHeader } from '../demoTypes';

interface Props {
  columns: ColumnDef<Row | GroupHeader>[];
  getRows: (
    start: number,
    end: number,
    req?: RowsRequest<Row | GroupHeader>,
  ) => Promise<GetRowsResult<Row | GroupHeader>>;
  rowCount: number;
  className: string;
  classes: Record<string, string>;
}

export default function CustomRenderPage({
  columns,
  getRows,
  rowCount,
  className,
  classes,
}: Props) {
  const pillColumns = React.useMemo(() => {
    const cols = columns.map((c) => ({ ...c }));
    const idx = cols.findIndex((c) => JSON.stringify(c.path) === JSON.stringify(['favourites', 'number']));
    if (idx >= 0) {
      cols[idx] = {
        ...cols[idx],
        render: (v: unknown, row: Row | GroupHeader, rowIndex: number) => {
          const isGroupHeader = (r: Row | GroupHeader): r is GroupHeader => '__group' in r;
          if (rowIndex === 10 && row && !isGroupHeader(row) && typeof v === 'number') {
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
          return String(v ?? '');
        },
      } as ColumnDef<Row | GroupHeader>;
    }
    return cols;
  }, [columns]);

  return (
    <MassiveTable<Row | GroupHeader>
      columns={pillColumns}
      getRows={getRows}
      rowCount={rowCount}
      className={className}
      classes={classes}
    />
  );
}

