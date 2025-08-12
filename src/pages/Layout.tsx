import * as React from 'react';
import { useDemo } from '../context/DemoContext';
import type { Row } from '../demo/types';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef, GetRowsResult } from '../lib/types';

export default function LayoutPage() {
  const { data, baseClasses, themeClass, columns } = useDemo();

  const gridA = React.useMemo(() => data.slice(0, 2500), [data]);
  const gridB = React.useMemo(() => data.slice(2500, 5000), [data]);
  const gridC = React.useMemo(() => data.slice(5000, 7500), [data]);
  const gridD = React.useMemo(() => data.slice(7500, 10000), [data]);

  const flexA = React.useMemo(() => data.filter((r) => r.category === 'one'), [data]);
  const flexB = React.useMemo(() => data.filter((r) => r.category === 'two'), [data]);
  const flexC = React.useMemo(() => data.filter((r) => r.favourites.number <= 50), [data]);

  const makeGetRows = React.useCallback(
    <T extends object>(arr: T[]) =>
      async (start: number, end: number): Promise<GetRowsResult<T>> => {
        const len = Math.max(0, end - start);
        return { rows: arr.slice(start, start + len), total: arr.length };
      },
    [],
  );

  return (
    <div>
      <section className="layout-section">
        <h3 className="layout-title">CSS Grid: 2 x 2 (auto-fill)</h3>
        <div className="layout-grid">
          {[
            ['gridA', gridA],
            ['gridB', gridB],
            ['gridC', gridC],
            ['gridD', gridD],
          ].map(([name, grid]) => (
            <div key={name as string} className="cell">
              <MassiveTable<Row>
                classes={baseClasses}
                className={themeClass}
                columns={columns as unknown as ColumnDef<Row>[]}
                getRows={makeGetRows<Row>(grid)}
                rowCount={grid.length}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="layout-section">
        <h3 className="layout-title">Flex: 3 cells (flex: 1 1 0)</h3>
        <div className="layout-flex">
          {[
            ['flexA', flexA],
            ['flexB', flexB],
            ['flexC', flexC],
          ].map(([name, arr]) => (
            <div key={name as string} className="cell">
              <MassiveTable<Row>
                classes={baseClasses}
                className={themeClass}
                columns={columns as unknown as ColumnDef<Row>[]}
                getRows={makeGetRows<Row>(arr)}
                rowCount={arr.length}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
