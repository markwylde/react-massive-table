import * as React from 'react';
import MassiveTable from './lib/MassiveTable';
import type { ColumnDef, GetRowsResult, RowsRequest } from './lib/types';

type LogRow = {
  index: number;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  trace_id: string | null;
  timestamp: Date;
  span_name?: string; // For trace spans
  duration_ms?: number; // For trace spans
  sql_query?: string; // For database spans
};

// Create example log data
function createLogData(): LogRow[] {
  const logs: LogRow[] = [];
  let index = 1;
  
  // Base timestamp - start from an hour ago
  const baseTime = new Date(Date.now() - 60 * 60 * 1000);
  let currentTime = baseTime.getTime();
  
  // Helper to increment time by random amount
  const nextTime = () => {
    currentTime += Math.random() * 5000 + 100; // 100ms to 5.1s later
    return new Date(currentTime);
  };
  
  // 20 normal log messages (no trace_id)
  const normalMessages = [
    'Application started successfully',
    'Database connection pool initialized',
    'Cache warmed up',
    'Scheduler started',
    'Background job processor ready',
    'Health check endpoint registered',
    'Metrics collection enabled',
    'User authentication middleware loaded',
    'Static file serving configured',
    'Rate limiting enabled',
    'CORS policy configured',
    'Session store initialized',
    'Email service connected',
    'File upload directory created',
    'API documentation generated',
    'Security headers configured',
    'Logging system initialized',
    'Configuration validated',
    'Routes registered successfully',
    'Application ready to serve requests'
  ];
  
  normalMessages.forEach(message => {
    logs.push({
      index: index++,
      level: Math.random() < 0.1 ? 'WARN' : Math.random() < 0.05 ? 'ERROR' : 'INFO',
      message,
      trace_id: null,
      timestamp: nextTime()
    });
  });
  
  // 5 messages with trace_id 1111111 (user registration request)
  const trace1Messages = [
    { message: 'Incoming POST /api/register request', span_name: 'http.request', duration_ms: 245 },
    { message: 'Validating user registration data', span_name: 'validation', duration_ms: 12 },
    { message: 'SELECT * FROM users WHERE email = ?', span_name: 'db.query', duration_ms: 8, sql_query: 'SELECT * FROM users WHERE email = ?' },
    { message: 'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', span_name: 'db.query', duration_ms: 15, sql_query: 'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)' },
    { message: 'User registration completed successfully', span_name: 'business.logic', duration_ms: 3 }
  ];
  
  trace1Messages.forEach(({ message, span_name, duration_ms, sql_query }) => {
    logs.push({
      index: index++,
      level: 'INFO',
      message,
      trace_id: '1111111',
      timestamp: nextTime(),
      span_name,
      duration_ms,
      sql_query
    });
  });
  
  // 5 messages with trace_id 2222222 (product search request)  
  const trace2Messages = [
    { message: 'Incoming GET /api/products/search request', span_name: 'http.request', duration_ms: 156 },
    { message: 'Parsing search query parameters', span_name: 'parsing', duration_ms: 5 },
    { message: 'SELECT * FROM products WHERE name ILIKE ? LIMIT 20', span_name: 'db.query', duration_ms: 23, sql_query: 'SELECT * FROM products WHERE name ILIKE ? LIMIT 20' },
    { message: 'SELECT COUNT(*) FROM products WHERE name ILIKE ?', span_name: 'db.query', duration_ms: 12, sql_query: 'SELECT COUNT(*) FROM products WHERE name ILIKE ?' },
    { message: 'Product search completed, returning 12 results', span_name: 'response.formatting', duration_ms: 8 }
  ];
  
  trace2Messages.forEach(({ message, span_name, duration_ms, sql_query }) => {
    logs.push({
      index: index++,
      level: 'INFO', 
      message,
      trace_id: '2222222',
      timestamp: nextTime(),
      span_name,
      duration_ms,
      sql_query
    });
  });
  
  // Sort by timestamp to simulate real log ordering
  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map((log, i) => ({ ...log, index: i + 1 }));
}

const columns: ColumnDef<LogRow>[] = [
  { path: ['index'], title: '#', width: 80 },
  { path: ['level'], title: 'Level', width: 100 },
  { path: ['message'], title: 'Message', width: 400 },
  { path: ['trace_id'], title: 'Trace ID', width: 120, inlineGroup: true },
  { 
    path: ['timestamp'], 
    title: 'Timestamp', 
    width: 180,
    render: (value) => value instanceof Date ? value.toLocaleTimeString() : ''
  },
];

interface LogTracingDemoProps {
  mode?: 'light' | 'dark';
}

export default function LogTracingDemo({ mode: propMode }: LogTracingDemoProps = {}) {
  const [mode, setMode] = React.useState<'light' | 'dark'>(propMode || 'light');
  
  // Sync with prop mode
  React.useEffect(() => {
    if (propMode) {
      setMode(propMode);
    }
  }, [propMode]);
  
  // Generate the log data
  const data = React.useMemo(() => {
    return createLogData();
  }, []);
  
  const getRows = React.useCallback(
    (start: number, end: number, _req?: RowsRequest<LogRow>): GetRowsResult<LogRow> => {
      const len = Math.max(0, end - start);
      // For now, just return the basic slice - inlineGroup logic will be added to MassiveTable
      return { rows: data.slice(start, start + len), total: data.length };
    },
    [data]
  );
  
  return (
    <div>
      <div style={{ marginBottom: 12, color: '#666', fontSize: 14 }}>
        <p style={{ margin: '0 0 8px 0' }}>This demo shows a log viewer with inline grouping by trace_id. Traces are collapsed by default and can be expanded to show individual spans.</p>
        <p style={{ margin: 0 }}>Data includes: 20 normal logs + 2 traces (trace_id: 1111111 & 2222222) with 5 spans each.</p>
      </div>
      
      <MassiveTable<LogRow>
        getRows={getRows}
        rowCount={data.length}
        columns={columns}
        mode={mode}
        style={{ height: '80vh', width: '100%' }}
      />
    </div>
  );
}