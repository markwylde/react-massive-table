import type { ColumnDef } from '../lib/types';
import type { GroupHeader, Row } from './types';

export const columns: ColumnDef<Row | GroupHeader>[] = [
  { path: ['index'], title: '#', width: 80, align: 'right' },
  { path: ['category'], title: 'Category', width: 200, align: 'left' },
  { path: ['favourites', 'colour'], title: 'Favourite Colour', width: 200 },
  { path: ['favourites', 'number'], title: 'Favourite Number', width: 140, align: 'right' },
  { path: ['lastName'], title: 'Last Name', width: 220 },
  { path: ['firstName'], title: 'First Name' },
];
