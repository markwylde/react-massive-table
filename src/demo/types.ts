export type Row = {
  index: number;
  firstName: string;
  lastName: string;
  category: 'one' | 'two' | null;
  favourites: { colour: string; number: number };
};

export type GroupHeader = {
  __group: true;
  key: string;
  depth: number;
  value: unknown;
  count: number;
  path: import('../lib/types').ColumnPath;
};

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogRow = {
  id: number;
  ts: number;
  level: LogLevel;
  message: string;
  trace_id: string | null;
  index: number;
};
