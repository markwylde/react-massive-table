import * as React from 'react';

import baseStyles from './styles/base.module.css';
import darkTheme from './styles/dark.module.css';
import lightTheme from './styles/light.module.css';
import type {
  ColumnDef,
  GetRowsResult,
  GroupBy,
  GroupState,
  MassiveTableProps,
  Sort,
  Theme,
} from './types';
import { clamp, getByPath, toPx } from './utils';

const DEFAULT_THEME: Theme = {
  bg: '#ffffff',
  color: '#0f172a',
  headerBg: '#f8fafc',
  headerColor: '#0f172a',
  rowHoverBg: '#f1f5f9',
  rowHoverColor: '#0f172a',
  borderColor: '#e2e8f0',
  scrollbarThumb: '#cbd5e1',
  scrollbarTrack: 'transparent',
  radius: '10px',
  headerHeight: '36px',
  cellPxY: '6px',
  headerCellPy: '4px',
  cellPxX: '10px',
  headerShadow: 'inset 0 -1px 0 rgba(15,23,42,0.08)',
  rowStripeBg: '#f8fafc',
  focusRing: '0 0 0 2px rgba(59,130,246,0.6)',
  dimOverlay: 'rgba(0,0,0,0.1)',
};

type Cache<Row> = {
  rows: (Row | undefined)[];
  version: number;
};

function useRowCache<Row>(count: number, resetKey?: unknown) {
  const [cache, setCache] = React.useState<Cache<Row>>({ rows: Array(count), version: 0 });
  React.useEffect(() => {
    setCache({ rows: Array(count), version: 0 });
  }, [count, resetKey]);
  const setRange = React.useCallback((start: number, data: Row[]) => {
    setCache((prev) => {
      const rows = prev.rows.slice();
      for (let i = 0; i < data.length; i++) rows[start + i] = data[i];
      return { rows, version: prev.version + 1 };
    });
  }, []);
  return { cache, setRange } as const;
}

function useColumnOrder<Row>(columns: ColumnDef<Row>[]) {
  const [order, setOrder] = React.useState<number[]>(() => columns.map((_, i) => i));
  const prevSigRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Only reset order when the column set actually changes (by path/length),
    // not when the parent recreates the array each render.
    const sig = columns.map((c) => JSON.stringify(c.path)).join('|');
    if (prevSigRef.current !== sig) {
      prevSigRef.current = sig;
      setOrder(columns.map((_, i) => i));
    }
  }, [columns]);
  const move = React.useCallback((from: number, to: number) => {
    setOrder((prev) => {
      if (from === to) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);
  const cols = order.map((i) => columns[i]);
  return { order, columnsOrdered: cols, move } as const;
}

export function MassiveTable<Row = unknown>(props: MassiveTableProps<Row>) {
  const {
    getRows,
    rowCount,
    columns,
    rowHeight = 'auto',
    overscan = 10,
    theme,
    mode = 'light',
    style,
    className,
    onVisibleRangeChange,
    onRowsRendered,
    onColumnOrderPreviewChange,
    onColumnOrderChange,
    onRowClick,
    classes: _classes,
    // Feature toggles (default off)
    enableSort = false,
    enableReorder = false,
    enableResize = false,
    showGroupByDropZone = false,
    // Controlled/uncontrolled state + events
    sorts: sortsProp,
    defaultSorts,
    onSortsChange,
    groupBy: groupByProp,
    defaultGroupBy,
    onGroupByChange,
    expandedKeys: expandedKeysProp,
    defaultExpandedKeys,
    onExpandedKeysChange,
  } = props;
  const cn = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' ');

  const [measuredRowHeight, setMeasuredRowHeight] = React.useState<number | null>(null);
  const rowH = measuredRowHeight || toPx(rowHeight, 48);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const [effectiveRowCount, setEffectiveRowCount] = React.useState<number>(rowCount);
  const [{ start, end }, setRange] = React.useState(() => ({
    start: 0,
    end: Math.min(rowCount, overscan * 2),
  }));
  // Sorting state (controlled/uncontrolled)
  const isSortsControlled = sortsProp !== undefined;
  const [sortsState, setSortsState] = React.useState<Sort<Row>[]>(defaultSorts ?? []);
  const sorts = (isSortsControlled ? sortsProp : sortsState) ?? [];
  const setSorts = React.useCallback(
    (updater: (prev: Sort<Row>[]) => Sort<Row>[]) => {
      const next = updater(sorts);
      if (!isSortsControlled) setSortsState(next);
      onSortsChange?.(next);
    },
    [isSortsControlled, sorts, onSortsChange],
  );
  const sortsSig = React.useMemo(
    () => sorts.map((s) => `${JSON.stringify(s.path)}:${s.dir}`).join('|'),
    [sorts],
  );

  // Grouping state (controlled/uncontrolled)
  const isGroupByControlled = groupByProp !== undefined;
  const [groupByState, setGroupByState] = React.useState<GroupBy<Row>[]>(defaultGroupBy ?? []);
  const groupBy = (isGroupByControlled ? groupByProp : groupByState) ?? [];
  const setGroupBy = React.useCallback(
    (updater: (prev: GroupBy<Row>[]) => GroupBy<Row>[]) => {
      const next = updater(groupBy);
      if (!isGroupByControlled) setGroupByState(next);
      onGroupByChange?.(next);
    },
    [isGroupByControlled, groupBy, onGroupByChange],
  );

  const isExpandedControlled = expandedKeysProp !== undefined;
  const [expandedKeysState, setExpandedKeysState] = React.useState<string[]>(
    defaultExpandedKeys ?? [],
  );
  const expandedKeys = (isExpandedControlled ? expandedKeysProp : expandedKeysState) ?? [];
  const expandedSet = React.useMemo(() => new Set(expandedKeys), [expandedKeys]);
  const setExpanded = React.useCallback(
    (updater: (prev: string[]) => string[]) => {
      const next = updater(expandedKeys);
      if (!isExpandedControlled) setExpandedKeysState(next);
      onExpandedKeysChange?.(next);
    },
    [isExpandedControlled, expandedKeys, onExpandedKeysChange],
  );
  // Signature of grouping keys (paths only) — excludes expanded state
  const groupPathsSig = React.useMemo(
    () => groupBy.map((g) => JSON.stringify(g.path)).join('|'),
    [groupBy],
  );
  // Full signature including expanded keys, used for data fetching/cache
  const groupSig = React.useMemo(() => {
    const ex = Array.from(expandedSet).sort().join('|');
    return `${groupPathsSig}::${ex}`;
  }, [groupPathsSig, expandedSet]);

  const { cache, setRange: setCacheRange } = useRowCache<Row>(
    effectiveRowCount,
    `${sortsSig}|${groupSig}`,
  );
  const { columnsOrdered, order, move } = useColumnOrder(columns);
  const hasInlineGroup = React.useMemo(() => columns.some((c) => !!c.inlineGroup), [columns]);

  // To avoid browser max scroll height limits (~16.7M px in some engines),
  // we chunk the scrollable canvas and keep a base offset we subtract from
  // absolute row tops when positioning.
  const MAX_SPACER_PX = 16_000_000; // stay below engine caps
  const [baseOffsetPx, setBaseOffsetPx] = React.useState(0);

  // Column widths (px) for layout, resizing, and horizontal scroll
  const defaultWidth = 160;
  const [colWidths, setColWidths] = React.useState<number[]>(() =>
    columnsOrdered.map((c) => c.width ?? defaultWidth),
  );
  // Keep widths in sync when the columns set (by identity) changes.
  // This runs when `columns` prop changes (not on drag preview reorders).
  const prevColumnsRef = React.useRef<ColumnDef<Row>[]>(columns);
  React.useEffect(() => {
    const prev = prevColumnsRef.current;
    // Build a map of previous widths by column identity
    const widthByPath = new Map<string, number>();
    for (let i = 0; i < prev.length; i++) {
      widthByPath.set(JSON.stringify(prev[i].path), colWidths[i] ?? prev[i].width ?? defaultWidth);
    }
    const next = columns.map(
      (c) => widthByPath.get(JSON.stringify(c.path)) ?? c.width ?? defaultWidth,
    );
    if (next.length !== colWidths.length || next.some((w, i) => w !== colWidths[i])) {
      setColWidths(next);
    }
    prevColumnsRef.current = columns;
  }, [columns]);

  // Capture widths at drag start and only remap widths to follow
  // columns after a successful drop (to keep preview simple).
  const dragStartWidthsRef = React.useRef<Map<string, number> | null>(null);

  // Fetch rows for visible window + overscan
  const requestId = React.useRef(0);
  const getRowsRef = React.useRef(getRows);
  React.useEffect(() => {
    getRowsRef.current = getRows;
  }, [getRows]);
  const onRowsRenderedRef = React.useRef(onRowsRendered);
  React.useEffect(() => {
    onRowsRenderedRef.current = onRowsRendered;
  }, [onRowsRendered]);
  React.useEffect(() => {
    const totalForRange = effectiveRowCount;
    const a = clamp(start - overscan, 0, totalForRange);
    const b = clamp(end + overscan, 0, totalForRange);
    const id = ++requestId.current;
    const req = {
      sorts,
      groupBy,
      groupState: { expandedKeys: Array.from(expandedSet) } as GroupState,
    };
    type MaybeGetRows = GetRowsResult<Row> | Row[] | unknown;
    const isGetRowsResult = (v: unknown): v is GetRowsResult<Row> =>
      typeof v === 'object' && v !== null && Array.isArray((v as { rows?: unknown }).rows);
    Promise.resolve(getRowsRef.current(a, b, req)).then((res: MaybeGetRows) => {
      if (requestId.current !== id) return; // stale
      let rows: Row[];
      let total = rowCount;
      if (Array.isArray(res)) {
        rows = res as Row[];
        total = rowCount;
      } else if (isGetRowsResult(res)) {
        rows = res.rows;
        total = res.total ?? rowCount;
      } else {
        rows = [] as Row[];
        total = rowCount;
      }
      setEffectiveRowCount(total);
      setCacheRange(a, rows);
      onRowsRenderedRef.current?.(a, b);
    });
  }, [start, end, overscan, rowCount, setCacheRange, sortsSig, groupSig, effectiveRowCount]);

  // Handle scroll to compute visible range
  const onScroll = React.useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    let scrollTop = el.scrollTop;
    const viewportH = el.clientHeight;

    const totalHeight = effectiveRowCount * rowH;
    if (totalHeight > MAX_SPACER_PX) {
      const contentH = Math.min(MAX_SPACER_PX, totalHeight - baseOffsetPx);
      const thresholdUp = contentH * 0.75;
      const thresholdDown = contentH * 0.25;
      // Move in large, row-aligned chunks to keep scrollTop in a safe range
      const rawChunk = Math.floor((MAX_SPACER_PX * 0.5) / rowH) * rowH || rowH;
      if (scrollTop > thresholdUp && baseOffsetPx + contentH < totalHeight) {
        const remaining = totalHeight - (baseOffsetPx + contentH);
        const chunk = Math.min(rawChunk, remaining);
        setBaseOffsetPx((prev) => prev + chunk);
        el.scrollTop = scrollTop - chunk;
        scrollTop = el.scrollTop;
      } else if (scrollTop < thresholdDown && baseOffsetPx > 0) {
        const chunk = Math.min(rawChunk, baseOffsetPx);
        setBaseOffsetPx((prev) => prev - chunk);
        el.scrollTop = scrollTop + chunk;
        scrollTop = el.scrollTop;
      }
    } else if (baseOffsetPx !== 0) {
      // Reset offset when total height drops below cap
      setBaseOffsetPx(0);
    }

    const firstRow = Math.floor((baseOffsetPx + scrollTop) / rowH);
    const visibleCount = Math.ceil(viewportH / rowH);
    const newStart = clamp(firstRow, 0, Math.max(0, effectiveRowCount - 1));
    const newEnd = clamp(firstRow + visibleCount, 0, effectiveRowCount);
    setRange((prev) =>
      prev.start !== newStart || prev.end !== newEnd ? { start: newStart, end: newEnd } : prev,
    );
    onVisibleRangeChange?.(newStart, newEnd);
  }, [rowH, effectiveRowCount, onVisibleRangeChange, baseOffsetPx]);

  React.useEffect(() => {
    onScroll();
  }, [effectiveRowCount, rowH]);

  // Build grid columns template based on widths
  const inlineColWidth = 28; // px for dedicated inline-group toggle column when present
  const gridTemplate = React.useMemo(() => {
    const widths = hasInlineGroup ? [inlineColWidth, ...colWidths] : colWidths;
    return widths.map((w) => `${w}px`).join(' ');
  }, [colWidths, hasInlineGroup]);
  const totalWidth = React.useMemo(() => {
    const base = colWidths.reduce((a, b) => a + b, 0);
    return hasInlineGroup ? base + inlineColWidth : base;
  }, [colWidths, hasInlineGroup]);

  const themeVars = React.useMemo(() => {
    const t = { ...DEFAULT_THEME, ...(theme ?? {}) };
    // Always provide layout-related variables that depend on props
    const layoutVars: React.CSSProperties & Record<string, string> = {
      '--massive-table-header-h': t.headerHeight ?? '36px',
      '--massive-table-cell-py': t.cellPxY ?? '8px',
      '--massive-table-header-cell-py': t.headerCellPy ?? t.cellPxY ?? '8px',
      '--massive-table-cell-px': t.cellPxX ?? '12px',
    };

    // If a theme object is provided, opt into setting color/visual variables.
    // Otherwise, let CSS modules (base or themed) own visual styling.
    if (theme) {
      return {
        ...layoutVars,
        '--massive-table-bg': t.bg,
        '--massive-table-color': t.color,
        '--massive-table-header-bg': t.headerBg,
        '--massive-table-header-color': t.headerColor,
        '--massive-table-row-hover-bg': t.rowHoverBg,
        '--massive-table-row-hover-color': t.rowHoverColor ?? t.color,
        '--massive-table-border': t.borderColor,
        '--massive-table-scrollbar-thumb': t.scrollbarThumb,
        '--massive-table-scrollbar-track': t.scrollbarTrack,
        '--massive-table-radius': t.radius ?? '8px',
        '--massive-table-header-shadow': t.headerShadow ?? 'inset 0 -1px 0 rgba(0,0,0,0.06)',
        '--massive-table-row-stripe': t.rowStripeBg ?? 'transparent',
        '--massive-table-focus-ring': t.focusRing ?? '0 0 0 2px rgba(59,130,246,0.65)',
        '--massive-table-dim-overlay': t.dimOverlay ?? 'rgba(0,0,0,0.1)',
      } as React.CSSProperties & Record<string, string>;
    }

    return layoutVars;
  }, [theme, rowH]);

  // Drag & drop handlers for columns
  const dragIndex = React.useRef<number | null>(null);
  // Track dragging state via refs; remove unused state variables
  const isDraggingRef = React.useRef(false);
  const endedByDropRef = React.useRef(false);
  const suppressClickRef = React.useRef<number>(0);
  const handleHeaderDragStart = (idx: number) => (e: React.DragEvent) => {
    dragIndex.current = idx;
    isDraggingRef.current = true;
    endedByDropRef.current = false;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    try {
      e.dataTransfer.setData('application/x-massive-table-col-idx', String(idx));
    } catch {}
    try {
      e.dataTransfer.setData(
        'application/x-massive-table-col-path',
        JSON.stringify(columnsOrdered[idx].path),
      );
    } catch {}
    // Use the header cell as drag image for a clean ghost
    const target = e.currentTarget as HTMLElement;
    try {
      e.dataTransfer.setDragImage(
        target,
        Math.min(20, target.offsetWidth / 2),
        target.offsetHeight / 2,
      );
    } catch {}
    // Capture widths by column identity so we can remap on drop
    const m = new Map<string, number>();
    for (let i = 0; i < columnsOrdered.length; i++) {
      m.set(
        JSON.stringify(columnsOrdered[i].path),
        colWidths[i] ?? columnsOrdered[i].width ?? defaultWidth,
      );
    }
    dragStartWidthsRef.current = m;
  };
  const handleHeaderDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!enableReorder) return;
    const from = dragIndex.current;
    if (from != null && from !== idx) {
      move(from, idx);
      dragIndex.current = idx;
    }
  };
  const handleHeaderDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current ?? Number(e.dataTransfer.getData('text/plain'));
    const to = idx;
    if (enableReorder && Number.isFinite(from) && Number.isFinite(to) && from !== to)
      move(from, to);
    dragIndex.current = null;
    isDraggingRef.current = false;
    endedByDropRef.current = true;
    // After drop, remap widths to follow the columns by identity
    const map = dragStartWidthsRef.current;
    if (map) {
      const next = columnsOrdered.map(
        (c) => map.get(JSON.stringify(c.path)) ?? c.width ?? defaultWidth,
      );
      setColWidths(next);
    }
    notifyFinalOrder();
    suppressClickRef.current = Date.now();
  };
  const handleHeaderDragEnd = () => {
    // Called when drag ends (drop or cancel). If drop already handled, skip.
    if (!endedByDropRef.current) {
      isDraggingRef.current = false;
      notifyFinalOrder();
    }
    endedByDropRef.current = false;
    suppressClickRef.current = Date.now();
  };

  // Column resize
  const resizing = React.useRef<{ i: number; startX: number; startW: number } | null>(null);
  const minColWidth = 60;
  const onResizeDown = (i: number) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    resizing.current = { i, startX: clientX, startW: colWidths[i] };
    // Prevent click/sort after a resize interaction
    suppressClickRef.current = Date.now();
    const handleMove = (cx: number) => {
      const dx = cx - (resizing.current?.startX ?? 0);
      const idx = resizing.current?.i ?? i;
      const minW = columnsOrdered[idx]?.minWidth ?? minColWidth;
      const newW = Math.max(minW, (resizing.current?.startW ?? 0) + dx);
      setColWidths((prev) => prev.map((w, j) => (j === idx ? newW : w)));
    };
    const onMouseMove = (ev: MouseEvent) => handleMove(ev.clientX);
    const onTouchMove = (ev: TouchEvent) => handleMove(ev.touches[0]?.clientX ?? 0);
    const onUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
      resizing.current = null;
      // Also suppress an immediate click that might toggle sort
      suppressClickRef.current = Date.now();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const totalHeight = effectiveRowCount * rowH;
  const contentHeight = Math.min(
    totalHeight - baseOffsetPx,
    totalHeight > MAX_SPACER_PX ? MAX_SPACER_PX : totalHeight,
  );

  // Measure the first row's natural height
  const firstRowRef = React.useRef<HTMLDivElement | null>(null);
  // Reset measured height when table structure changes (sorts/group-by paths),
  // but NOT on expand/collapse to avoid flashing reflows.
  React.useEffect(() => {
    setMeasuredRowHeight(null);
  }, [sortsSig, groupPathsSig]);

  React.useLayoutEffect(() => {
    if (measuredRowHeight !== null) return; // Already measured
    const el = firstRowRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setMeasuredRowHeight(Math.round(rect.height));
      }
    });
  }, [measuredRowHeight, cache.version]);

  // Notify parent of column order changes
  const onPreviewRef = React.useRef(
    onColumnOrderChange as undefined | ((o: number[], c: ColumnDef<Row>[]) => void),
  );
  const onFinalRef = React.useRef(
    onColumnOrderChange as undefined | ((o: number[], c: ColumnDef<Row>[]) => void),
  );
  // Backward compatibility: if a separate preview callback is provided, use it
  // otherwise, keep using onColumnOrderChange for both preview and final.
  onPreviewRef.current = onColumnOrderPreviewChange || undefined;
  onFinalRef.current = onColumnOrderChange;
  React.useEffect(() => {
    if (isDraggingRef.current) {
      onPreviewRef.current?.(order, columnsOrdered);
    }
  }, [order, columnsOrdered]);
  // Final notification on drop/cancel. Called in drag end handlers.
  const notifyFinalOrder = React.useCallback(() => {
    onFinalRef.current?.(order, columnsOrdered);
  }, [order, columnsOrdered]);

  // Sorting handlers
  const pathEq = React.useCallback((a: (string | number)[], b: (string | number)[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }, []);
  const toggleSortForColumnIndex = (colIdx: number, additive: boolean) => {
    if (!enableSort) return;
    if (isDraggingRef.current) return; // ignore click during drag
    if (Date.now() - suppressClickRef.current < 200) return; // ignore click immediately after drag
    const col = columnsOrdered[colIdx];
    const idx = sorts.findIndex((s) => pathEq(s.path, col.path));
    // Cycle: none -> asc -> desc -> none
    if (idx === -1) {
      const nextEntry: Sort<Row> = { path: col.path, dir: 'asc' };
      setSorts((prev) => (additive ? [...prev, nextEntry] : [nextEntry]));
    } else {
      const cur = sorts[idx];
      if (cur.dir === 'asc') {
        const updated: Sort<Row> = { ...cur, dir: 'desc' };
        setSorts((prev) => {
          const copy = prev.slice();
          if (additive) {
            copy[idx] = updated;
            return copy;
          }
          return [updated];
        });
      } else {
        // dir === 'desc' -> remove
        setSorts((prev) => {
          if (additive) return prev.filter((_, i) => i !== idx);
          return [];
        });
      }
    }
  };

  // Group bar drag/drop handlers
  const groupDragIndex = React.useRef<number | null>(null);
  const groupDropInsideRef = React.useRef<boolean>(false);
  // During a group-chip drag, accept drops anywhere inside the table viewport
  const groupScopedHandlersRef = React.useRef<null | {
    el: HTMLElement;
    over: (e: DragEvent) => void;
    drop: (e: DragEvent) => void;
  }>(null);
  const [groupOver, setGroupOver] = React.useState<boolean>(false);
  const onGroupBarDragOver = (e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes('application/x-massive-table-col-idx') ||
      e.dataTransfer.types.includes('application/x-massive-table-group-idx') ||
      e.dataTransfer.types.includes('text/plain')
    ) {
      e.preventDefault();
      setGroupOver(true);
    }
  };
  const onGroupBarDragEnter = (e: React.DragEvent) => {
    // Only mark as over when entering the bar from outside,
    // ignore enters from its children.
    if (e.currentTarget === e.target) setGroupOver(true);
  };
  const onGroupBarDragLeave = (e: React.DragEvent) => {
    // Only mark as not over when leaving the bar to outside,
    // ignore leaves into its children.
    if (e.currentTarget === e.target) setGroupOver(false);
  };
  const onGroupBarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setGroupOver(false);
    // Mark that a drop occurred within the group bar region
    groupDropInsideRef.current = true;
    const colPathStr = e.dataTransfer.getData('application/x-massive-table-col-path');
    const colIdxStr =
      e.dataTransfer.getData('application/x-massive-table-col-idx') ||
      e.dataTransfer.getData('text/plain');
    const fromGroupStr = e.dataTransfer.getData('application/x-massive-table-group-idx');
    if (fromGroupStr) return; // reordering handled continuously during drag
    if (colPathStr) {
      try {
        const path = JSON.parse(colPathStr);
        const pathKey = JSON.stringify(path);
        setGroupBy((prev) =>
          prev.find((g) => JSON.stringify(g.path) === pathKey) ? prev : [...prev, { path }],
        );
      } catch {
        // fallback to index if parsing fails
        const colIdx = Number(colIdxStr);
        if (!Number.isFinite(colIdx)) return;
        const col = columnsOrdered[colIdx];
        if (!col) return;
        const pathKey = JSON.stringify(col.path);
        setGroupBy((prev) =>
          prev.find((g) => JSON.stringify(g.path) === pathKey)
            ? prev
            : [...prev, { path: col.path }],
        );
      }
      return;
    }
    const colIdx = Number(colIdxStr);
    if (!Number.isFinite(colIdx)) return;
    const col = columnsOrdered[colIdx];
    if (!col) return;
    {
      const pathKey = JSON.stringify(col.path);
      setGroupBy((prev) =>
        prev.find((g) => JSON.stringify(g.path) === pathKey) ? prev : [...prev, { path: col.path }],
      );
    }
    // Collapsed by default: expandedSet remains unchanged
  };

  const onGroupChipDragStart = (i: number) => (e: React.DragEvent) => {
    groupDragIndex.current = i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-massive-table-group-idx', String(i));
    // Drag originates inside the group bar; consider pointer over the bar
    setGroupOver(true);
    // Reset drop flag for this drag sequence
    groupDropInsideRef.current = false;

    // Hide the browser's default drag ghost using an in-DOM transparent element
    if (dragImageRef.current) {
      try {
        e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
      } catch {}
    }

    // Scoped accept: while dragging a group chip, treat drops anywhere in the page
    // as accepted to avoid browser snap-back. Limited to this MIME type only.
    const el = document.body;
    if (el) {
      const over = (ev: DragEvent) => {
        const types = Array.from(ev.dataTransfer?.types ?? []);
        if (types.includes('application/x-massive-table-group-idx')) {
          ev.preventDefault();
          if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        }
      };
      const drop = (ev: DragEvent) => {
        const types = Array.from(ev.dataTransfer?.types ?? []);
        if (types.includes('application/x-massive-table-group-idx')) {
          ev.preventDefault();
        }
      };
      groupScopedHandlersRef.current = { el, over, drop };
      el.addEventListener('dragover', over);
      el.addEventListener('drop', drop);
    }
  };
  const onGroupChipDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = groupDragIndex.current;
    if (from == null || from === i) return;
    setGroupBy((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    groupDragIndex.current = i;
  };
  const onGroupChipDragEnd = (i: number) => () => {
    // Cleanup scoped accept listeners
    if (groupScopedHandlersRef.current) {
      const { el, over, drop } = groupScopedHandlersRef.current;
      el.removeEventListener('dragover', over);
      el.removeEventListener('drop', drop);
      groupScopedHandlersRef.current = null;
    }
    // If drag ended outside the group bar (no drop inside), remove the group
    if (!groupDropInsideRef.current) {
      setGroupBy((prev) => prev.filter((_, idx) => idx !== i));
      // Dropping a level may invalidate deeper group keys; clear expanded
      setExpanded(() => []);
    }
    groupDragIndex.current = null;
    groupDropInsideRef.current = false;
  };

  const onGroupChipDrop = (_i: number) => (e: React.DragEvent) => {
    // Drop occurred on a chip in the group bar
    e.preventDefault();
    groupDropInsideRef.current = true;
  };

  const toggleGroupKey = (key: string) => {
    setExpanded((prevArr) => {
      const s = new Set(prevArr);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return Array.from(s);
    });
  };

  const themeClass = mode === 'dark' ? darkTheme.theme : lightTheme.theme;
  const dragImageRef = React.useRef<HTMLDivElement | null>(null);
  const groupBarRef = React.useRef<HTMLDivElement | null>(null);
  const [groupBarHeight, setGroupBarHeight] = React.useState<number | null>(null);

  // Keep a CSS var in sync with the actual group bar height so the header's
  // sticky offset matches reality (chips can wrap and change height).
  React.useLayoutEffect(() => {
    if (!showGroupByDropZone) return;
    const el = groupBarRef.current;
    if (!el) return;
    const update = () => setGroupBarHeight(el.offsetHeight);
    update();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } catch {}
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [groupBy.length, showGroupByDropZone]);

  return (
    <div
      className={cn(baseStyles.root, themeClass, className)}
      style={{
        ...themeVars,
        // Fallback to header height var until measured
        ...(showGroupByDropZone
          ? groupBarHeight != null
            ? { ['--massive-table-groupbar-h' as string]: `${groupBarHeight}px` }
            : {}
          : { ['--massive-table-groupbar-h' as string]: '0px' }),
        ...style,
      }}
    >
      {/* Invisible drag image placeholder to suppress default ghost */}
      <div ref={dragImageRef} className={baseStyles.dragImage} aria-hidden />
      <div ref={bodyRef} onScroll={onScroll} className={baseStyles.viewport}>
        {showGroupByDropZone && (
          <div
            ref={groupBarRef}
            role="toolbar"
            aria-label="Group by bar"
            onDragEnter={onGroupBarDragEnter}
            onDragOver={onGroupBarDragOver}
            onDragLeave={onGroupBarDragLeave}
            onDrop={onGroupBarDrop}
            className={cn(baseStyles.groupBar, groupOver && baseStyles.groupBarOver)}
          >
            <span className={baseStyles.groupLabel}>Group By:</span>
            {groupBy.length === 0 && (
              <span className={baseStyles.groupEmpty}>Drag a column header here</span>
            )}
            {groupBy.map((g, i) => {
              const title =
                columns.find((c) => JSON.stringify(c.path) === JSON.stringify(g.path))?.title ??
                JSON.stringify(g.path);
              return (
                <button
                  key={JSON.stringify(g.path)}
                  draggable
                  onDragStart={onGroupChipDragStart(i)}
                  onDragOver={onGroupChipDragOver(i)}
                  onDrop={onGroupChipDrop(i)}
                  onDragEnd={onGroupChipDragEnd(i)}
                  title="Drag to reorder. Drag off to remove."
                  type="button"
                  className={baseStyles.groupChip}
                >
                  {title}
                </button>
              );
            })}
          </div>
        )}
        <div
          className={baseStyles.header}
          style={{ gridTemplateColumns: gridTemplate, width: totalWidth }}
        >
          {hasInlineGroup && (
            <div key="__inline-toggle" className={baseStyles.headerCell} aria-hidden />
          )}
          {columnsOrdered.map((col, i) => {
            const sortIdx = sorts.findIndex((s) => pathEq(s.path, col.path));
            const sortDir = sortIdx >= 0 ? sorts[sortIdx].dir : null;
            const draggableFor = enableReorder || showGroupByDropZone;
            const clickableForSort = enableSort && !draggableFor;
            return (
              <button
                key={order[i]}
                title={col.headerTooltip}
                draggable={draggableFor}
                onClick={(e) => toggleSortForColumnIndex(i, e.shiftKey || e.metaKey || e.ctrlKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSortForColumnIndex(i, e.shiftKey || e.metaKey || e.ctrlKey);
                  }
                }}
                onDragStart={handleHeaderDragStart(i)}
                onDragOver={handleHeaderDragOver(i)}
                onDrop={handleHeaderDrop(i)}
                onDragEnd={handleHeaderDragEnd}
                type="button"
                className={cn(
                  baseStyles.headerCell,
                  draggableFor && baseStyles.headerCellGrab,
                  clickableForSort && baseStyles.headerCellClickable,
                )}
              >
                <span className={baseStyles.headerTitle}>{col.title}</span>
                {sortDir && (
                  <span aria-hidden className={baseStyles.headerSort}>
                    {sortDir === 'asc' ? '▲' : '▼'}
                    {sorts.length > 1 && sortIdx >= 0 && <span>{sortIdx + 1}</span>}
                  </span>
                )}
                {enableResize && (
                  <span
                    aria-hidden="true"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onMouseDown={(e) => onResizeDown(i)(e)}
                    onTouchStart={(e) => onResizeDown(i)(e)}
                    className={baseStyles.resizeGrip}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className={baseStyles.rows} style={{ height: contentHeight, width: totalWidth }}>
          {Array.from({ length: Math.max(0, end - start) }).map((_, i) => {
            const rowIndex = start + i;
            const row = cache.rows[rowIndex];
            const top = rowIndex * rowH - baseOffsetPx;
            return (
              <React.Fragment key={rowIndex}>
                {/* biome-ignore lint/a11y/useSemanticElements: row cannot be <button> due to nested buttons */}
                <div
                  ref={measuredRowHeight === null && i === 0 ? firstRowRef : null}
                  style={{
                    top,
                    gridTemplateColumns: gridTemplate,
                    width: totalWidth,
                  }}
                  onClick={() => row != null && onRowClick?.(row, rowIndex)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (row != null) onRowClick?.(row, rowIndex);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    baseStyles.row,
                    (() => {
                      type InlineMeta = {
                        __inlineGroupMember?: boolean;
                        __inlineGroupAnchor?: boolean;
                        __inlineGroupExpanded?: boolean;
                      };
                      const v = row as unknown as InlineMeta | null | undefined;
                      const isMember = !!v?.__inlineGroupMember;
                      const isExpandedAnchor = !!(
                        v?.__inlineGroupAnchor && v?.__inlineGroupExpanded
                      );
                      return isMember || isExpandedAnchor ? baseStyles.inlineGroupMember : '';
                    })(),
                  )}
                >
                  {(() => {
                    const isGroupRow = (
                      v: unknown,
                    ): v is {
                      __group: true;
                      key: string;
                      depth?: number;
                      value?: unknown;
                      count?: number;
                      path?: (string | number)[];
                    } =>
                      typeof v === 'object' &&
                      v !== null &&
                      '__group' in (v as Record<string, unknown>);
                    const r = row;
                    if (isGroupRow(r)) {
                      const expanded = expandedSet.has(r.key);
                      return (
                        <div
                          className={baseStyles.groupRow}
                          style={{
                            paddingLeft: `calc(var(--massive-table-cell-px) + ${(r.depth ?? 0) * 16}px)`,
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroupKey(r.key);
                            }}
                            aria-label={expanded ? 'Collapse group' : 'Expand group'}
                            type="button"
                            className={baseStyles.groupToggle}
                          >
                            {expanded ? '▾' : '▸'}
                          </button>
                          {(() => {
                            const pathArr = Array.isArray(r.path) ? r.path : [];
                            const col = columns.find(
                              (c) => JSON.stringify(c.path) === JSON.stringify(pathArr),
                            );
                            const labelKey =
                              col?.title ?? String(pathArr[pathArr.length - 1] ?? '');
                            return <span>{`${labelKey}: ${String(r.value)}`}</span>;
                          })()}
                          <span>{r.count}</span>
                        </div>
                      );
                    }
                    // Optional leading inline-group toggle column
                    const meta = (row ?? ({} as unknown)) as {
                      __inlineGroupKey?: string;
                      __inlineGroupAnchor?: boolean;
                      __inlineGroupMember?: boolean;
                      __inlineGroupExpanded?: boolean;
                    };

                    const inlineCell = hasInlineGroup ? (
                      <div
                        key={`${rowIndex}:-1`}
                        className={baseStyles.cell}
                        style={{
                          padding: 0,
                          margin: 'calc(var(--massive-table-cell-py) * -1) 0',
                          height: 'calc(100% + var(--massive-table-cell-py) * 2)',
                        }}
                      >
                        {row == null ? (
                          <span
                            style={{
                              opacity: 0.4,
                              padding: '0 var(--massive-table-cell-px)',
                              display: 'flex',
                              alignItems: 'center',
                              height: '100%',
                            }}
                          >
                            …
                          </span>
                        ) : (
                          (() => {
                            const key = meta.__inlineGroupKey;
                            const isAnchor = !!meta.__inlineGroupAnchor;
                            const isMember = !!meta.__inlineGroupMember;
                            const expanded = key
                              ? expandedSet.has(key)
                              : !!meta.__inlineGroupExpanded;
                            const arrow = isAnchor ? (expanded ? '▾' : '▸') : isMember ? '·' : '';
                            const onToggle = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              if (!key) return;
                              toggleGroupKey(key);
                            };
                            return (
                              <>
                                {isAnchor ? (
                                  <button
                                    onClick={onToggle}
                                    aria-label={expanded ? 'Collapse trace' : 'Expand trace'}
                                    type="button"
                                    style={{
                                      width: '18px',
                                      height: '100%',
                                      border: 'none',
                                      background: 'var(--massive-table-inline-group-bg)',
                                      color: 'inherit',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 12,
                                      margin: 0,
                                      padding: 0,
                                    }}
                                  >
                                    {arrow}
                                  </button>
                                ) : (
                                  <div
                                    style={{
                                      width: '18px',
                                      height: '100%',
                                      background: isMember
                                        ? 'var(--massive-table-inline-group-bg)'
                                        : 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 12,
                                    }}
                                  >
                                    {arrow}
                                  </div>
                                )}
                              </>
                            );
                          })()
                        )}
                      </div>
                    ) : null;

                    const dataCells = columnsOrdered.map((col, ci) => {
                      const value = row == null ? undefined : getByPath(row, col.path);
                      const content = col.render ? (
                        col.render(value, row as Row, rowIndex)
                      ) : value === null ? (
                        <span>null</span>
                      ) : (
                        String(value ?? '')
                      );
                      const align = col.align ?? 'left';
                      const cellStyle: React.CSSProperties = { textAlign: align };
                      return (
                        <div
                          key={`${rowIndex}:${order[ci]}`}
                          style={cellStyle}
                          className={baseStyles.cell}
                        >
                          {row == null ? <span style={{ opacity: 0.4 }}>…</span> : content}
                        </div>
                      );
                    });

                    return [inlineCell, ...dataCells].filter(Boolean);
                  })()}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MassiveTable;
