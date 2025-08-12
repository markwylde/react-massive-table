import * as React from 'react';
import { useDemo } from '../context/DemoContext';
import type { GroupHeader, Row } from '../demo/types';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef } from '../lib/types';

export default function VisibilityPage() {
  const { columns, getRows, data, dataVersion, baseClasses, themeClass } = useDemo();
  const allKeys = React.useMemo(() => columns.map((c) => JSON.stringify(c.path)), [columns]);
  const [visibleKeys, setVisibleKeys] = React.useState<string[]>(allKeys);

  const visibleColumns = React.useMemo(() => {
    const set = new Set(visibleKeys);
    return (columns as unknown as ColumnDef<Row | GroupHeader>[]).filter((c) =>
      set.has(JSON.stringify(c.path)),
    );
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
      <h2 className="heading">Column Visibility</h2>
      <div style={{ marginBottom: 12 }}>
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
        key={`visibility:${visibleColumns.length}:${dataVersion}`}
        getRows={getRows}
        rowCount={data.length}
        columns={visibleColumns}
        classes={baseClasses}
        className={themeClass}
        style={{ height: '70vh', width: '100%' }}
      />
    </div>
  );
}
