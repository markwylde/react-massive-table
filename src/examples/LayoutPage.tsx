import * as React from 'react';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef, GetRowsResult } from '../lib/types';
import type { Row, GroupHeader } from '../demoTypes';

interface Props {
  data: Row[];
  columns: ColumnDef<Row | GroupHeader>[];
  className: string;
  classes: Record<string, string>;
}

export default function LayoutPage({ data, columns, className, classes }: Props) {
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
          <div className="cell">
            <MassiveTable<Row>
              key="grid-a"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(gridA)}
              rowCount={gridA.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
          <div className="cell">
            <MassiveTable<Row>
              key="grid-b"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(gridB)}
              rowCount={gridB.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
          <div className="cell">
            <MassiveTable<Row>
              key="grid-c"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(gridC)}
              rowCount={gridC.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
          <div className="cell">
            <MassiveTable<Row>
              key="grid-d"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(gridD)}
              rowCount={gridD.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className="layout-section">
        <h3 className="layout-title">Flex: 3 cells (flex: 1 1 0)</h3>
        <div className="layout-flex">
          <div className="cell">
            <MassiveTable<Row>
              key="flex-a"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(flexA)}
              rowCount={flexA.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
          <div className="cell">
            <MassiveTable<Row>
              key="flex-b"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(flexB)}
              rowCount={flexB.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
          <div className="cell">
            <MassiveTable<Row>
              key="flex-c"
              classes={classes}
              className={className}
              columns={columns as ColumnDef<Row>[]}
              getRows={makeGetRows<Row>(flexC)}
              rowCount={flexC.length}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

