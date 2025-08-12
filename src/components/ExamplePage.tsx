import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import * as React from 'react';
import { useDemo } from '../context/DemoContext';
import type { GroupHeader, Row } from '../demo/types';
import MassiveTable from '../lib/MassiveTable';
import type { ColumnDef } from '../lib/types';

export type Variant = {
  name: string;
  props: Partial<React.ComponentProps<typeof MassiveTable<Row | GroupHeader>>>;
  note?: string;
};

export type ExamplePageProps = {
  exampleKey: string;
  title: string;
  variants: Variant[];
  variantIndex: number;
  onVariantChange: (idx: number) => void;
};

export const ExamplePage: React.FC<ExamplePageProps> = ({
  exampleKey,
  title,
  variants,
  variantIndex,
  onVariantChange,
}) => {
  const { columns, getRows, data, dataVersion, baseClasses, themeClass } = useDemo();

  const activeVariant = variants[variantIndex] ?? variants[0];

  const usageCode = React.useMemo(() => {
    const v = activeVariant;
    const isLogs = exampleKey === 'logs';
    const baseHeader = `import MassiveTable from 'react-massive-table';\n`;
    const baseRow = isLogs
      ? `type Row = { id: number; ts: number; level: 'DEBUG'|'INFO'|'WARN'|'ERROR'; message: string; trace_id?: string|null; index: number };\n`
      : `type Row = { index: number; firstName: string; lastName: string; category: 'one'|'two'|null; favourites: { colour: string; number: number } };\n`;
    const cols = isLogs
      ? `const columns = [\n  { path: ['index'], title: '#', width: 80 },\n  { path: ['level'], title: 'Level', width: 200 },\n  { path: ['message'], title: 'Message' },\n  { path: ['trace_id'], title: 'Trace ID', inlineGroup: true },\n];\n`
      : `const columns = [\n  { path: ['index'], title: '#', width: 80, align: 'right' },\n  { path: ['category'], title: 'Category', width: 200 },\n  { path: ['favourites','colour'], title: 'Favourite Colour', width: 200 },\n  { path: ['favourites','number'], title: 'Favourite Number', width: 140, align: 'right' },\n  { path: ['lastName'], title: 'Last Name', width: 220 },\n  { path: ['firstName'], title: 'First Name' },\n];\n`;
    const getRowsSig = isLogs
      ? `async function getRows(start: number, end: number, req?: RowsRequest<Row>) : Promise<GetRowsResult<Row>> { /*...*/ }\n`
      : `async function getRows(start: number, end: number, req?: RowsRequest<Row>) : Promise<GetRowsResult<Row>> { /*...*/ }\n`;

    const props = [] as string[];
    const p = v.props as Partial<React.ComponentProps<typeof MassiveTable<Row>>>;
    if (p.enableSort) props.push(`enableSort`);
    if (p.enableReorder) props.push(`enableReorder`);
    if (p.enableResize) props.push(`enableResize`);
    if (p.showGroupByDropZone) props.push(`showGroupByDropZone`);
    if (p.columns) props.push(`columns={columns}`);
    if (p.getRows) props.push(`getRows={getRows}`);
    if (p.rowCount !== undefined) props.push(`rowCount={ROW_COUNT}`);
    if (p.defaultSorts) props.push(`defaultSorts={[/*...*/] as Sort[]}`);
    if (p.defaultExpandedKeys) props.push(`defaultExpandedKeys={[/*...*/] as string[]}`);
    if (p.expandedKeys) props.push(`expandedKeys={expandedKeys}`);
    if (p.onExpandedKeysChange) props.push(`onExpandedKeysChange={setExpandedKeys}`);
    if (p.defaultGroupBy) props.push(`defaultGroupBy={[/*...*/]}`);
    if (p.rowHeight !== undefined) props.push(`rowHeight={${JSON.stringify(p.rowHeight)}}`);

    const open = `<MassiveTable<Row>\n`;
    const body = props.map((line) => `  ${line}`).join('\n');
    const close = `\n/>`;
    return [
      baseHeader,
      baseRow,
      `/* Columns */\n${cols}`,
      `/* Data fetching */\n${getRowsSig}`,
      `/* Usage */\n${open}${body}${close}`,
    ].join('\n');
  }, [activeVariant, exampleKey]);

  const usageHtml = React.useMemo(
    () => Prism.highlight(usageCode, Prism.languages.tsx, 'tsx'),
    [usageCode],
  );
  const usageCodeRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (usageCodeRef.current) usageCodeRef.current.innerHTML = usageHtml;
  }, [usageHtml]);

  const copyUsage = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(usageCode);
    } catch {}
  }, [usageCode]);

  return (
    <div>
      <div className="example-header">
        <h2 className="heading">{title}</h2>
        {variants.length > 1 && (
          <div className="variant-tabs" role="tablist" aria-label="Example variants">
            {variants.map((v, i) => (
              <button
                key={v.name}
                role="tab"
                aria-selected={variantIndex === i}
                className={variantIndex === i ? 'active' : ''}
                type="button"
                onClick={() => onVariantChange(i)}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeVariant.note && (
        <p className="subtle" style={{ marginTop: 0 }}>
          {activeVariant.note}
        </p>
      )}

      <MassiveTable<Row | GroupHeader>
        key={`page:${exampleKey}:${variantIndex}:${dataVersion}`}
        getRows={activeVariant.props.getRows ?? getRows}
        rowCount={activeVariant.props.rowCount ?? data.length}
        columns={
          (activeVariant.props.columns as ColumnDef<Row | GroupHeader>[] | undefined) ?? columns
        }
        classes={baseClasses}
        className={themeClass}
        {...activeVariant.props}
        style={{ height: '70vh', width: '100%', ...(activeVariant.props.style ?? {}) }}
      />

      <section className="usage">
        <div className="usage-head">
          <h3 className="usage-title">Usage</h3>
          <div className="usage-actions">
            <button type="button" className="ghost-btn" onClick={copyUsage}>
              Copy
            </button>
          </div>
        </div>
        <pre className="code language-tsx">
          <code ref={usageCodeRef} className="language-tsx" />
        </pre>
      </section>
    </div>
  );
};
