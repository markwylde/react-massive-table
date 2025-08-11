/// <reference lib="webworker" />
// Web Worker to generate rows off the main thread
// Avoids importing Chance here due to its UMD worker global side effects.
// Implements a lightweight deterministic PRNG instead.

type Row = {
  index: number;
  firstName: string;
  lastName: string;
  category: 'one' | 'two' | null;
  favourites: { colour: string; number: number };
};

type GenerateMessage = {
  type: 'generate';
  count: number;
  seed: number | string;
};
// Deterministic PRNG helpers (xmur3 + mulberry32)
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Olivia',
  'Liam',
  'Emma',
  'Noah',
  'Ava',
  'Oliver',
  'Sophia',
  'Elijah',
  'Isabella',
  'James',
  'Mia',
  'William',
  'Amelia',
  'Benjamin',
  'Harper',
  'Lucas',
  'Evelyn',
  'Henry',
  'Abigail',
  'Theodore',
  'Emily',
  'Jack',
  'Elizabeth',
  'Levi',
  'Sofia',
  'Alexander',
  'Avery',
  'Jackson',
  'Ella',
  'Mateo',
  'Scarlett',
  'Daniel',
  'Grace',
  'Michael',
  'Chloe',
  'Mason',
  'Camila',
  'Sebastian',
  'Luna',
  'Ethan',
  'Victoria',
  'Logan',
  'Aria',
  'Owen',
  'Penelope',
  'Samuel',
  'Layla',
  'Jacob',
  'Riley',
];
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
];
const COLOURS = [
  'red',
  'green',
  'blue',
  'orange',
  'purple',
  'teal',
  'pink',
  'brown',
  'gray',
  'black',
  'white',
  'silver',
  'gold',
  'violet',
  'indigo',
  'magenta',
  'cyan',
  'maroon',
  'olive',
  'navy',
];

function makeRow(i: number, seed: number | string): Row {
  const seedStr = typeof seed === 'string' ? seed : String(seed);
  const h = xmur3(`${seedStr}-${i}`)();
  const rnd = mulberry32(h);
  const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length) % arr.length];
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const category = rnd() < 0.33 ? 'one' : rnd() < 0.66 ? 'two' : null;
  const colour = pick(COLOURS);
  const number = 1 + Math.floor(rnd() * 100);
  return { index: i + 1, firstName, lastName, category, favourites: { colour, number } };
}

self.addEventListener('message', (evt: MessageEvent<GenerateMessage>) => {
  const msg = evt.data;
  if (!msg || msg.type !== 'generate') return;
  const { count, seed } = msg;
  // Generate synchronously inside the worker
  const rows: Row[] = new Array(count);
  for (let i = 0; i < count; i++) rows[i] = makeRow(i, seed);
  // Send back to main thread
  (self as unknown as Worker).postMessage({ type: 'generated', rows });
});
