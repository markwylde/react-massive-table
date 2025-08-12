import type { ColumnPath } from './lib/types';

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
  path: ColumnPath;
};
