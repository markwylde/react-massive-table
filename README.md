# React Massive Table

High-performance, virtualized React table for massive datasets. Ships with column resizing, drag-reorder, multi-sort, and an optional group-by bar. Light/dark themes included via CSS variables and CSS Modules.

## Why This

- **Massive data**: Renders visible rows only, with overscan, and avoids browser scroll height limits by chunking large scroll ranges.
- **Pluggable data source**: You provide `getRows(start, end, req)` that can stream from memory, an API, IndexedDB, etc.
- **UX features built-in**: Sort toggles, column drag-reorder, resize grips, row click handling, and an optional "Group by" drop zone.
- **Theming**: Light/dark presets and token overrides via CSS variables.
- **TypeScript first**: Full types for rows, columns, and events.

## Installation

```bash
npm i react-massive-table
```

**Peer deps**: `react@>=18`, `react-dom@>=18`

**Optional CSS file**: If your bundler does not auto-inject CSS from ESM, import `react-massive-table/styles.css` once in your app entry.

## Quick Start

Minimal, client-side rows from an in-memory array:

```tsx
import { MassiveTable } from 'react-massive-table'

type Row = { id: number; name: string; value: number }
const data: Row[] = Array.from({ length: 100_000 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  value: Math.round(Math.random() * 1000),
}))

const columns = [
  { path: ['id'], title: 'ID', width: 80, align: 'right' },
  { path: ['name'], title: 'Name', width: 240 },
  { path: ['value'], title: 'Value', width: 140, align: 'right' },
]

function App() {
  const getRows = (start: number, end: number) => ({
    rows: data.slice(start, end),
    total: data.length,
  })
  return (
    <MassiveTable<Row>
      getRows={getRows}
      rowCount={data.length}
      columns={columns}
      style={{ height: '70vh', width: '100%' }}
    />
  )
}
```

## Core Concepts

- **Virtualization**: You provide `rowCount` and `getRows(start, end, req)`. The table asks for the visible window plus `overscan` and renders only those rows. `rowHeight` can be a number, a CSS length string, or `'auto'` to measure the first row.
- **Columns by path**: Each column defines a `path` as an array to access nested values (e.g. `['stats', 'score']`). Provide a `render` function for custom cells.
- **Sorting**: Click a header to cycle none → asc → desc. Click another header to add a multi-sort. Controlled and uncontrolled modes supported via `sorts`, `defaultSorts`, and `onSortsChange`.
- **Reorder & resize**: Drag header cells to reorder columns. Resize via the grip at the right edge of each header (respects optional `minWidth`).
- **Grouping (optional)**: Enable the group bar to drag headers into it and build nested groups. Control programmatically via `groupBy`, `onGroupByChange`, and `expandedKeys`.
- **Theming**: Switch `mode='light' | 'dark'` for built-ins, or pass a `theme` token object to override colors, paddings, and radii.

## API Reference

### `MassiveTable<Row>(props)`

#### Required Props
- `getRows(start, end, req)`: Returns either `Row[]` or `{ rows: Row[]; total: number }`. `req` contains current `sorts`, `groupBy`, and `{ expandedKeys }` for servers that flatten grouped results.
- `rowCount: number`: Total row count (or the current flattened total when grouping server-side).
- `columns: ColumnDef<Row>[]`: Column definitions.

#### Optional Props
- `rowHeight?: number | string | 'auto'`: Default `'auto'`. Numeric pixels, CSS length, or auto-measure first row.
- `overscan?: number`: Default `10`. Extra rows above/below viewport to keep scrolling smooth.
- `mode?: 'light' | 'dark'`: Default `'light'`. Chooses the preset theme.
- `theme?: Partial<Theme>`: Optional token overrides (CSS variables) for fine-tuning visuals.
- `style?: React.CSSProperties`, `className?: string`: Container styling.
- `enableSort?: boolean`: Default `true`.
- `enableReorder?: boolean`: Default `true`.
- `enableResize?: boolean`: Default `true`.
- `showGroupByDropZone?: boolean`: Default `true`.

#### Event Handlers
- `onVisibleRangeChange?(start, end)`: Fires during scroll/range updates.
- `onRowsRendered?(start, end)`: Fires after a fetch/render completes for a range.
- `onRowClick?(row, rowIndex)`: Row click handler.
- `onColumnOrderPreviewChange?(order, columns)`: Live updates while dragging headers.
- `onColumnOrderChange?(order, columns)`: Final order after drop or cancel.

#### Controlled Props
- **Controlled sorting**: `sorts`, `defaultSorts`, `onSortsChange`.
- **Controlled grouping**: `groupBy`, `defaultGroupBy`, `onGroupByChange`.
- **Controlled expansion**: `expandedKeys`, `defaultExpandedKeys`, `onExpandedKeysChange`.

### `ColumnDef<Row>`

- `path: (string | number)[]`: Required. Access path into your row object.
- `title: string`: Required. Header label.
- `width?: number`: Initial width in px.
- `minWidth?: number`: Minimum width in px.
- `align?: 'left' | 'center' | 'right'`: Cell text alignment.
- `headerTooltip?: string`: Optional title tooltip for the header.
- `render?(value, row, rowIndex)`: Custom cell renderer (return React nodes).

### `getRows` Request Shape

`RowsRequest<Row>` passed to `getRows(start, end, req)`:

```tsx
{
  sorts?: { path: ColumnPath; dir: 'asc' | 'desc' }[]
  groupBy?: { path: ColumnPath }[]
  groupState?: { expandedKeys: string[] }
}
```

If you provide grouped data, emit a flattened stream with "group header" rows when appropriate and respect `expandedKeys` for expansion. A group header has the shape:

```tsx
{ __group: true, key: string, depth?: number, value?: unknown, count?: number, path?: ColumnPath }
```

## Grouping Example (client-side)

The demo shows a client-side implementation that sorts, builds a group tree, and flattens it according to `expandedKeys`. For large data, prefer doing this on the server and returning a flattened slice plus `total`.

## Theming

Built-ins: `mode='light' | 'dark'` set sensible defaults via CSS variables.

**Token overrides** (pass `theme`):
- `bg`, `color`, `headerBg`, `headerColor`
- `rowHoverBg`, `rowHoverColor`, `rowStripeBg`
- `borderColor`, `scrollbarThumb`, `scrollbarTrack`
- `radius`, `headerHeight`, `cellPxY`, `cellPxX`, `headerCellPy`
- `headerShadow`, `focusRing`, `dimOverlay`

**Example**:
```tsx
<MassiveTable
  getRows={getRows}
  rowCount={rowCount}
  columns={columns}
  mode="dark"
  theme={{ radius: '8px', headerHeight: '44px' }}
/>
```

## Accessibility

- Headers are buttons with clear labels and small sort indicators.
- Rows are focusable and can be activated with Enter/Space when `onRowClick` is provided.
- Group toggles have accessible labels for expand/collapse.

## Performance Tips

- Keep `getRows` referentially stable when possible; the component guards against stale effects, but stable references avoid extra work.
- Cache or memoize server calls by `(start, end, sortsSig, groupSig)` if you expect repeated ranges.
- Provide consistent `columns` identity: this component preserves column order state across renders and resets only when the set of column `path`s changes.
- Use a fixed numeric `rowHeight` when rows are uniform. `'auto'` measures the first row; for highly variable heights, prefer a fixed height for smooth scrolling.

## Testing & Demo

The repo contains tests covering basic rendering, sorting, drag-reorder, resize, and grouping behaviors.

A demo app (`src/App.tsx`) generates deterministic data, showcases grouping, and toggles between light/dark modes.

## FAQ

- **Do I have to use the group bar?** No; set `showGroupByDropZone={false}`.
- **Can I control sorting/grouping externally?** Yes—use the controlled props and their `on*Change` callbacks.
- **Do I need to import CSS?** Most bundlers will include CSS emitted by the ES module automatically; if not, import `react-massive-table/styles.css` once.

## License

MIT
