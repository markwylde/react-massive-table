import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { act } from 'react';
import * as React from 'react';
import { Tabletron } from '../src';
import type { ColumnDef, GetRowsResult, RowsRequest } from '../src/lib/types';

type Row = { a: number; b: string };

const columns: ColumnDef<Row>[] = [
  { path: ['a'], title: 'A', width: 100 },
  { path: ['b'], title: 'B', width: 100 },
];

function makeGetRowsGrouped() {
  // Return two group header rows regardless of range
  const grouped = [
    { __group: true as const, key: JSON.stringify(['X']), depth: 0, value: 'X', count: 5, path: ['a'] },
    { __group: true as const, key: JSON.stringify(['Y']), depth: 0, value: 'Y', count: 5, path: ['a'] },
  ];
  return vi
    .fn<
      [number, number, RowsRequest<Row> | undefined],
      GetRowsResult<any>
    >()
    .mockImplementation((start, end, _req) => ({ rows: grouped.slice(start, end), total: grouped.length }));
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

describe('Tabletron grouping', () => {
  it('adds a group via header -> group bar drop', async () => {
    const getRows = makeGetRowsGrouped();
    render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={2}
        columns={columns}
        style={{ height: 240, width: 400 }}
      />,
    );
    const headerA = screen.getByRole('button', { name: 'A' });
    const groupBar = screen.getByRole('toolbar', { name: /Group by bar/i });
    const dt = new MockDataTransfer();
    // Include the column path payload
    dt.setData('application/x-tabletron-col-path', JSON.stringify(['a']));
    await act(async () => {
      fireEvent.dragStart(headerA, { dataTransfer: dt });
      fireEvent.dragOver(groupBar, { dataTransfer: dt });
      fireEvent.drop(groupBar, { dataTransfer: dt });
    });
    // A chip with title 'A' should appear inside the group bar
    expect(within(groupBar).getByRole('button', { name: 'A' })).toBeInTheDocument();
  });

  it('removes a group when chip drag ends outside', async () => {
    const getRows = makeGetRowsGrouped();
    const { container } = render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={2}
        columns={columns}
        defaultGroupBy={[{ path: ['a'] }]}
      />,
    );
    const groupBar = screen.getByRole('toolbar', { name: /Group by bar/i });
    const chip = within(groupBar).getByRole('button', { name: 'A' });
    const dt = new MockDataTransfer();
    await act(async () => {
      fireEvent.dragStart(chip, { dataTransfer: dt });
      // End drag without dropping on the bar
      fireEvent.dragEnd(chip, { dataTransfer: dt });
    });
    expect(within(groupBar).queryByRole('button', { name: 'A' })).toBeNull();
  });

  it('toggles group row expand/collapse', async () => {
    const getRows = makeGetRowsGrouped();
    render(
      <Tabletron<Row>
        getRows={getRows}
        rowCount={2}
        columns={columns}
      />,
    );
    // There should be group rows with toggle buttons
    const toggles = await screen.findAllByRole('button', { name: 'Expand group' });
    await act(async () => {
      fireEvent.click(toggles[0]);
    });
    expect(toggles[0].getAttribute('aria-label')).toBe('Collapse group');
  });
});
