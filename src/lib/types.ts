export type ColumnPath = (string | number)[];

export type ColumnDef<Row = unknown> = {
  path: ColumnPath;
  title: string;
  width?: number; // px
  minWidth?: number; // px
  align?: 'left' | 'center' | 'right';
  headerTooltip?: string;
  render?: (value: unknown, row: Row, rowIndex: number) => React.ReactNode;
  // When true, this column's values can be used to inline-group logically related rows
  // (e.g., trace_id), showing only the first occurrence while collapsed.
  // Note: This is distinct from the Group By feature.
  inlineGroup?: boolean;
};

export type SortDirection = 'asc' | 'desc';

export type Sort<_Row = unknown> = {
  path: ColumnPath;
  dir: SortDirection;
};

export type GroupBy<_Row = unknown> = {
  path: ColumnPath;
};

export type GroupState = {
  // List of expanded group keys (JSON-stringified tuple of group values)
  expandedKeys: string[];
};

export type RowsRequest<Row = unknown> = {
  sorts?: Sort<Row>[];
  groupBy?: GroupBy<Row>[];
  groupState?: GroupState;
};

export type GetRowsResult<Row = unknown> = {
  rows: Row[];
  // Total number of rows emitted given current sorts/grouping/state
  total: number;
};

export type GetRows<Row = unknown> = (
  startInclusive: number,
  endExclusive: number,
  req?: RowsRequest<Row>,
) => Promise<GetRowsResult<Row> | Row[]> | GetRowsResult<Row> | Row[];

export type MassiveTableEvents<Row = unknown> = {
  onVisibleRangeChange?: (start: number, end: number) => void;
  onRowsRendered?: (start: number, end: number) => void;
  // Fires while dragging columns as the order changes live
  onColumnOrderPreviewChange?: (order: number[], columns: ColumnDef<Row>[]) => void;
  // Fires after a drag completes (drop/cancel)
  onColumnOrderChange?: (order: number[], columns: ColumnDef<Row>[]) => void;
  onRowClick?: (row: Row, rowIndex: number) => void;
  // Controlled-state change events
  onSortsChange?: (sorts: Sort<Row>[]) => void;
  onGroupByChange?: (groupBy: GroupBy<Row>[]) => void;
  onExpandedKeysChange?: (expandedKeys: string[]) => void;
};

export type MassiveTableProps<Row = unknown> = MassiveTableEvents<Row> & {
  getRows: GetRows<Row>;
  rowCount: number;
  columns: ColumnDef<Row>[];
  rowHeight?: number | string | 'auto'; // e.g. 48, '75px', or 'auto'
  overscan?: number; // number of extra rows above/below
  style?: React.CSSProperties;
  className?: string;
  // Optional CSS Modules override for theming
  classes?: Record<string, string>;
  // Feature toggles
  enableSort?: boolean; // default: false
  enableReorder?: boolean; // default: false (column drag to reorder)
  enableResize?: boolean; // default: false (column resize handles)
  showGroupByDropZone?: boolean; // default: false (shows group bar)
  // Controlled/uncontrolled sorting
  sorts?: Sort<Row>[];
  defaultSorts?: Sort<Row>[];
  // Controlled/uncontrolled grouping
  groupBy?: GroupBy<Row>[];
  defaultGroupBy?: GroupBy<Row>[];
  // Controlled/uncontrolled expanded group keys
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
};
