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

export default function ColumnReorderPage({
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
      enableReorder
      className={className}
      classes={classes}
    />
  );
}
