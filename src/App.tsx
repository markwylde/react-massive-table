import Chance from 'chance';
import * as React from 'react';
import type { GroupHeader, Row } from './demoTypes';
import AllFeaturesPage from './examples/AllFeaturesPage';
import BasicPage from './examples/BasicPage';
import ColumnReorderPage from './examples/ColumnReorderPage';
import ColumnResizePage from './examples/ColumnResizePage';
import ColumnVisibilityPage from './examples/ColumnVisibilityPage';
import CustomRenderPage from './examples/CustomRenderPage';
import GroupingPage from './examples/GroupingPage';
import LayoutPage from './examples/LayoutPage';
import LogsPage from './examples/LogsPage';
import SortingPage from './examples/SortingPage';
import baseClasses from './lib/styles/base.module.css';
import darkTheme from './lib/styles/dark.module.css';
import lightTheme from './lib/styles/light.module.css';
import type { ColumnDef, GetRowsResult, RowsRequest } from './lib/types';
import { getByPath } from './lib/utils';

const SEED = 1337;
const DEFAULT_ROW_COUNT = 10_000;

const columns: ColumnDef<Row | GroupHeader>[] = [
  { path: ['index'], title: '#', width: 80, align: 'right' },
  { path: ['category'], title: 'Category', width: 200, align: 'left' },
  { path: ['favourites', 'colour'], title: 'Favourite Colour', width: 200 },
  { path: ['favourites', 'number'], title: 'Favourite Number', width: 140, align: 'right' },
  { path: ['lastName'], title: 'Last Name', width: 220 },
  { path: ['firstName'], title: 'First Name' },
];

function generateRows(count: number): Row[] {
  const rows: Row[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const c = new Chance(`${SEED}-${i}`);
    rows[i] = {
      index: i + 1,
      firstName: c.first(),
      lastName: c.last(),
      category: c.pick(['one', 'two', null]),
      favourites: {
        colour: c.color({ format: 'name' }),
        number: c.integer({ min: 1, max: 100 }),
      },
    };
  }
  return rows;
}

export default function App() {
  const [mode] = React.useState<'light' | 'dark'>('light');
  const [data] = React.useState<Row[]>(() => generateRows(DEFAULT_ROW_COUNT));

  const sortedCacheRef = React.useRef<Map<string, Row[]>>(new Map());
  const groupedCacheRef = React.useRef<Map<string, (Row | GroupHeader)[]>>(new Map());

  const getRows = React.useCallback(
    async (
      start: number,
      end: number,
      req?: RowsRequest<Row | GroupHeader>,
    ): Promise<GetRowsResult<Row | GroupHeader>> => {
      const len = Math.max(0, end - start);
      const sorts = req?.sorts ?? [];
      const groupBy = req?.groupBy ?? [];
      const expandedSet = new Set(req?.groupState?.expandedKeys ?? []);

      const sortSig = sorts.map((s) => `${JSON.stringify(s.path)}:${s.dir}`).join('|');
      let sorted = sortedCacheRef.current.get(sortSig);
      if (!sorted) {
        if (sorts.length === 0) {
          sorted = data;
        } else {
          const cmp = (a: Row, b: Row) => {
            for (const s of sorts) {
              const va = getByPath(a, s.path);
              const vb = getByPath(b, s.path);
              if (va == null && vb == null) continue;
              if (va == null) return s.dir === 'asc' ? 1 : -1;
              if (vb == null) return s.dir === 'asc' ? -1 : 1;
              let d = 0;
              if (typeof va === 'number' && typeof vb === 'number') {
                d = va - vb;
              } else {
                const sa = String(va).toLocaleString();
                const sb = String(vb).toLocaleString();
                d = sa < sb ? -1 : sa > sb ? 1 : 0;
              }
              if (d !== 0) return s.dir === 'asc' ? d : -d;
            }
            return 0;
          };
          sorted = data.slice().sort(cmp);
        }
        sortedCacheRef.current.set(sortSig, sorted);
      }

      if (groupBy.length === 0) {
        return { rows: sorted.slice(start, start + len), total: sorted.length };
      }

      const paths = groupBy.map((g) => g.path);
      const gbSig = paths.map((p) => JSON.stringify(p)).join('|');
      const exSig = Array.from(expandedSet).sort().join('|');
      const key = `${sortSig}::${gbSig}::${exSig}`;
      let flattened = groupedCacheRef.current.get(key);
      if (!flattened) {
        type GroupNode = {
          key: string;
          depth: number;
          value: unknown;
          rows: Row[];
          children?: Map<string, GroupNode>;
        };
        const root: GroupNode = { key: 'root', depth: 0, value: null, rows: sorted };
        const build = (node: GroupNode, depth: number) => {
          if (depth >= paths.length) return;
          const path = paths[depth];
          const map = new Map<string, GroupNode>();
          for (const r of node.rows) {
            const v = getByPath(r, path);
            const k = JSON.stringify([
              ...(JSON.parse(node.key === 'root' ? '[]' : node.key) as unknown[]),
              v,
            ]);
            let child = map.get(k);
            if (!child) {
              child = { key: k, depth, value: v, rows: [] } as GroupNode;
              map.set(k, child);
            }
            child.rows.push(r);
          }
          node.children = map;
          for (const c of map.values()) build(c, depth + 1);
        };
        build(root, 0);

        const out: (Row | GroupHeader)[] = [];
        const flatten = (node: GroupNode) => {
          if (!node.children) return;
          for (const child of node.children.values()) {
            const header: GroupHeader = {
              __group: true,
              key: child.key,
              depth: child.depth,
              value: child.value,
              count: child.rows.length,
              path: paths[child.depth],
            };
            out.push(header);
            const isExpanded = expandedSet.has(child.key);
            if (isExpanded) {
              if (child.children) {
                flatten(child);
              } else {
                out.push(...child.rows);
              }
            }
          }
        };
        flatten(root);
        flattened = out;
        groupedCacheRef.current.set(key, flattened);
      }
      return { rows: flattened.slice(start, start + len), total: flattened.length };
    },
    [data],
  );

  const themeClass = mode === 'dark' ? darkTheme.theme : lightTheme.theme;

  type Page =
    | 'basic'
    | 'visibility'
    | 'logs'
    | 'custom'
    | 'sorting'
    | 'reorder'
    | 'resize'
    | 'grouping'
    | 'all'
    | 'layout';

  const parseHash = React.useCallback((): { page: Page; variant?: string } => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const [pageRaw, variant] = hash.split('/');
    const pages: Page[] = [
      'basic',
      'visibility',
      'logs',
      'custom',
      'sorting',
      'reorder',
      'resize',
      'grouping',
      'all',
      'layout',
    ];
    const page = pages.includes(pageRaw as Page) ? (pageRaw as Page) : 'basic';
    return { page, variant };
  }, []);

  const [route, setRoute] = React.useState(parseHash);
  React.useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [parseHash]);

  let pageEl: React.ReactNode;
  switch (route.page) {
    case 'logs':
      pageEl = (
        <LogsPage
          className={themeClass}
          classes={baseClasses}
          defaultSortDir={route.variant === 'asc' ? 'asc' : 'desc'}
        />
      );
      break;
    case 'visibility':
      pageEl = (
        <ColumnVisibilityPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'custom':
      pageEl = (
        <CustomRenderPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'sorting':
      pageEl = (
        <SortingPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'reorder':
      pageEl = (
        <ColumnReorderPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'resize':
      pageEl = (
        <ColumnResizePage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'grouping':
      pageEl = (
        <GroupingPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'all':
      pageEl = (
        <AllFeaturesPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
      break;
    case 'layout':
      pageEl = (
        <LayoutPage data={data} columns={columns} className={themeClass} classes={baseClasses} />
      );
      break;
    default:
      pageEl = (
        <BasicPage
          columns={columns}
          getRows={getRows}
          rowCount={data.length}
          className={themeClass}
          classes={baseClasses}
        />
      );
  }

  const navItems = [
    { key: 'basic', label: 'Basic Table' },
    { key: 'visibility', label: 'Column Visibility' },
    { key: 'logs', label: 'Logs (inline group)' },
    { key: 'custom', label: 'Custom Render' },
    { key: 'sorting', label: 'Sorting' },
    { key: 'reorder', label: 'Column Reorder' },
    { key: 'resize', label: 'Column Resize' },
    { key: 'grouping', label: 'Grouping' },
    { key: 'all', label: 'All Features' },
    { key: 'layout', label: 'Layout (grid + flex)' },
  ];

  return (
    <div>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {navItems.map((n) => (
          <a
            key={n.key}
            href={`#/${n.key}`}
            style={{
              textDecoration: route.page === n.key ? 'underline' : 'none',
            }}
          >
            {n.label}
          </a>
        ))}
      </nav>
      {pageEl}
    </div>
  );
}
