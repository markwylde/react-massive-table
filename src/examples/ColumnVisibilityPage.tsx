import * as React from 'react';
import type { GroupHeader, Row } from '../demoTypes';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef, GetRowsResult, RowsRequest } from '../lib/types';

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

export default function ColumnVisibilityPage({
  columns,
  getRows,
  rowCount,
  className,
  classes,
}: Props) {
  const allKeys = React.useMemo(() => columns.map((c) => JSON.stringify(c.path)), [columns]);
  const [visibleKeys, setVisibleKeys] = React.useState<string[]>(allKeys);

  const visibleColumns = React.useMemo(() => {
    const set = new Set(visibleKeys);
    return columns.filter((c) => set.has(JSON.stringify(c.path)));
  }, [columns, visibleKeys]);

  const toggleKey = (key: string) => {
    setVisibleKeys((prev) => {
      const has = prev.includes(key);
      if (has) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 className="usage-title" style={{ margin: 0 }}>
          Toggle Columns
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          {columns.map((c) => {
            const key = JSON.stringify(c.path);
            const checked = visibleKeys.includes(key);
            const disable = checked && visibleKeys.length <= 1;
            return (
              <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disable}
                  onChange={() => toggleKey(key)}
                />
                <span>{c.title ?? key}</span>
              </label>
            );
          })}
        </div>
      </div>
      <MassiveTable<Row | GroupHeader>
        key={`visibility:${visibleColumns.length}`}
        columns={visibleColumns}
        getRows={getRows}
        rowCount={rowCount}
        className={className}
        classes={classes}
      />
    </div>
  );
}
