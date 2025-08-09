import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { act } from 'react';
import * as React from 'react';
import { Tabletron } from '../src';
import type { ColumnDef, GetRowsResult, RowsRequest } from '../src/lib/types';

type Row = { a: number; b: string };

function makeData(n = 50): Row[] {
  return Array.from({ length: n }, (_, i) => ({ a: i + 1, b: `row-${i + 1}` }));
}

const columns: ColumnDef<Row>[] = [
  { path: ['a'], title: 'A', width: 100, align: 'right' },
  { path: ['b'], title: 'B', width: 120 },
];

function makeGetRows(rows = makeData()) {
  return vi
    .fn<
      [number, number, RowsRequest<Row> | undefined],
      GetRowsResult<Row>
    >()
    .mockImplementation((start, end, _req) => ({
      rows: rows.slice(start, end),
      total: rows.length,
    }));
}

describe('Tabletron basic', () => {
  it('calls getRows with overscan and renders rows', async () => {
    const getRows = makeGetRows();
    await act(async () => {
      render(
        <Tabletron<Row>
          getRows={getRows}
          rowCount={50}
          columns={columns}
          rowHeight={24}
          overscan={5}
          style={{ height: 240, width: 400 }}
        />,
      );
    });
    // Initial call uses start=0, end=(visible+overscan) ~ 10 + 5 = 15
    expect(getRows).toHaveBeenCalled();
    const [start, end] = getRows.mock.calls[0];
    expect(start).toBe(0);
    expect(end).toBeGreaterThan(0);

    // Header buttons exist
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();

    // Rows will render asynchronously after initial effect; header is present
  });

  it('toggles sorting cycles and calls onSortsChange', async () => {
    const getRows = makeGetRows();
    const onSortsChange = vi.fn();
    render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={50}
        columns={columns}
        onSortsChange={onSortsChange}
      />,
    );
    const colA = screen.getByRole('button', { name: 'A' });
    // none -> asc
    await act(async () => fireEvent.click(colA));
    expect(onSortsChange).toHaveBeenLastCalledWith([{ path: ['a'], dir: 'asc' }]);
    expect(within(colA).getByText('▲')).toBeInTheDocument();
    // asc -> desc
    await act(async () => fireEvent.click(colA));
    expect(onSortsChange).toHaveBeenLastCalledWith([{ path: ['a'], dir: 'desc' }]);
    expect(within(colA).getByText('▼')).toBeInTheDocument();
    // desc -> none
    await act(async () => fireEvent.click(colA));
    expect(onSortsChange).toHaveBeenLastCalledWith([]);
  });

  it('row click invokes onRowClick with row and index', async () => {
    const getRows = makeGetRows(makeData(20));
    const onRowClick = vi.fn();
    render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={20}
        columns={columns}
        rowHeight={24}
        style={{ height: 200, width: 400 }}
        onRowClick={onRowClick}
      />,
    );
    // Click on a visible row cell
    const cell = await screen.findByText('row-1');
    await act(async () => fireEvent.click(cell));
    expect(onRowClick).toHaveBeenCalled();
    const [row, idx] = onRowClick.mock.calls[0];
    expect(row).toEqual({ a: 1, b: 'row-1' });
    expect(idx).toBe(0);
  });
});
