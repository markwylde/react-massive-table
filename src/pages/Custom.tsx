import * as React from 'react';
import { ExamplePage } from '../components/ExamplePage';
import { useDemo } from '../context/DemoContext';
import type { GroupHeader, Row } from '../demo/types';
import type { ColumnDef } from '../lib/types';

export default function CustomRenderPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  const { columns } = useDemo();

  const pillColumns: ColumnDef<Row | GroupHeader>[] = React.useMemo(() => {
    const cols = (columns as ColumnDef<Row | GroupHeader>[]).map((c) => ({ ...c }));
    const idx = cols.findIndex(
      (c) => JSON.stringify(c.path) === JSON.stringify(['favourites', 'number']),
    );
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
    <ExamplePage
      exampleKey="custom"
      title="Custom Render"
      variants={[
        {
          name: 'Red pill cell',
          props: { columns: pillColumns },
          note: 'Shows a red pill for one specific cell using a column render override.',
        },
      ]}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
