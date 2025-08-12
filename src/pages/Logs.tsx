import * as React from 'react';
import { ExamplePage } from '../components/ExamplePage';
import { useDemo } from '../context/DemoContext';
import type { GroupHeader, Row } from '../demo/types';
import type { ColumnDef, GetRowsResult, RowsRequest, Sort } from '../lib/types';

export default function LogsPage({
  variantIndex,
  onVariantChange,
}: {
  variantIndex: number;
  onVariantChange: (i: number) => void;
}) {
  const { logsColumns, getRowsLogs, logsData, logsExpandedKeys, setLogsExpandedKeys } = useDemo();

  const variants = React.useMemo(
    () => [
      {
        name: 'Trace collapse/expand by Trace ID',
        props: {
          columns: logsColumns as unknown as ColumnDef<GroupHeader | Record<string, unknown>>[],
          getRows: getRowsLogs as unknown as (
            start: number,
            end: number,
            req?: RowsRequest<Row | GroupHeader>,
          ) => Promise<GetRowsResult<Row | GroupHeader>>,
          rowCount: logsData.length,
          enableSort: true,
          defaultSorts: [{ path: ['index'], dir: 'desc' }] as unknown as Sort[],
          expandedKeys: logsExpandedKeys,
          onExpandedKeysChange: setLogsExpandedKeys,
        },
        note: '30 logs; traces inlined under the first occurrence.',
      },
      {
        name: 'Inline group + Index Asc',
        props: {
          columns: logsColumns as unknown as ColumnDef<Row | GroupHeader>[],
          getRows: getRowsLogs as unknown as (
            start: number,
            end: number,
            req?: RowsRequest<Row | GroupHeader>,
          ) => Promise<GetRowsResult<Row | GroupHeader>>,
          rowCount: logsData.length,
          enableSort: true,
          defaultSorts: [{ path: ['index'], dir: 'asc' }] as unknown as Sort[],
          expandedKeys: logsExpandedKeys,
          onExpandedKeysChange: setLogsExpandedKeys,
        },
        note: 'Same data but sorted by index ascending by default.',
      },
    ],
    [getRowsLogs, logsColumns, logsData.length, logsExpandedKeys, setLogsExpandedKeys],
  );

  return (
    <ExamplePage
      exampleKey="logs"
      title="Logs (inline group)"
      variants={variants}
      variantIndex={variantIndex}
      onVariantChange={onVariantChange}
    />
  );
}
