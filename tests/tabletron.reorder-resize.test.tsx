import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import * as React from 'react';
import { Tabletron } from '../src';
import type { ColumnDef, GetRowsResult, RowsRequest } from '../src/lib/types';

type Row = { a: number; b: string };

const columns: ColumnDef<Row>[] = [
  { path: ['a'], title: 'A', width: 100 },
  { path: ['b'], title: 'B', width: 100 },
];

function makeGetRows(n = 10) {
  const rows = Array.from({ length: n }, (_, i) => ({ a: i + 1, b: `row-${i + 1}` }));
  return vi
    .fn<
      [number, number, RowsRequest<Row> | undefined],
      GetRowsResult<Row>
    >()
    .mockImplementation((start, end, _req) => ({ rows: rows.slice(start, end), total: n }));
}

class MockDataTransfer {
  store = new Map<string, string>();
  dropEffect = 'move';
  effectAllowed = 'all';
  types: string[] = [];
  setData(type: string, data: string) {
    this.store.set(type, data);
    if (!this.types.includes(type)) this.types.push(type);
  }
  getData(type: string) {
    return this.store.get(type) || '';
  }
  setDragImage() {}
}

describe('Tabletron reorder & resize', () => {
  it('reorders columns via drag and notifies preview/final', async () => {
    const getRows = makeGetRows();
    const onPreview = vi.fn();
    const onFinal = vi.fn();
    render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={10}
        columns={columns}
        enableReorder
        onColumnOrderPreviewChange={onPreview}
        onColumnOrderChange={onFinal}
      />,
    );
    const a = screen.getByRole('button', { name: 'A' });
    const b = screen.getByRole('button', { name: 'B' });
    const dt = new MockDataTransfer();
    await act(async () => {
      fireEvent.dragStart(a, { dataTransfer: dt });
      fireEvent.dragOver(b, { dataTransfer: dt });
    });
    // order should be previewed as swapped
    expect(onPreview).toHaveBeenCalled();
    const lastPreview = onPreview.mock.calls.at(-1)![0];
    expect(lastPreview).toEqual([1, 0]);
    await act(async () => {
      fireEvent.drop(b, { dataTransfer: dt });
      fireEvent.dragEnd(a, { dataTransfer: dt });
    });
    // final order should be emitted
    expect(onFinal).toHaveBeenCalled();
    const final = onFinal.mock.calls.at(-1)![0];
    expect(final).toEqual([1, 0]);
  });

  it('resizes a column via grip drag', async () => {
    const getRows = makeGetRows();
    const { container } = render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={10}
        columns={columns}
        enableResize
      />,
    );
    const headerA = screen.getByRole('button', { name: 'A' });
    const headerRow = headerA.parentElement as HTMLElement; // header container
    const before = headerRow.style.gridTemplateColumns;
    // last span inside header is the resize grip (when no sort indicator)
    const grip = headerA.querySelector('span[aria-hidden="true"]') as HTMLElement;
    // Start at 100px and move +20px
    await act(async () => {
      fireEvent.mouseDown(grip, { clientX: 100 });
      fireEvent.mouseMove(window, { clientX: 120 });
      fireEvent.mouseUp(window);
    });
    const after = headerRow.style.gridTemplateColumns;
    // wait a tick for React state updates to flush
    await new Promise((r) => setTimeout(r, 0));
    const updated = headerRow.style.gridTemplateColumns;
    expect(updated).not.toBe(before);
    expect(updated.startsWith('120px')).toBe(true);
  });
});
