import * as React from 'react';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef, GetRowsResult, RowsRequest, Sort } from '../lib/types';
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

export default function SortingPage({
  columns,
  getRows,
  rowCount,
  className,
  classes,
}: Props) {
  return (
    <MassiveTable<Row | GroupHeader>
      columns={columns}
      getRows={getRows}
      rowCount={rowCount}
      enableSort
      defaultSorts={[{ path: ['lastName'], dir: 'asc' }] as Sort[]}
      className={className}
      classes={classes}
    />
  );
}

