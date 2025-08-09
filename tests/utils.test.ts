import { describe, expect, it } from 'vitest';
import { clamp, getByPath, toPx } from '../src/lib/utils';

describe('utils', () => {
  it('getByPath: reads nested values', () => {
    const obj = { a: { b: [{ c: 42 }] } };
    expect(getByPath(obj, ['a', 'b', 0, 'c'])).toBe(42);
  });

  it('getByPath: returns undefined for missing path', () => {
    const obj = { a: 1 } as unknown;
    expect(getByPath(obj, ['a', 'x'])).toBeUndefined();
  });

  it('toPx: handles numbers and strings', () => {
    expect(toPx(24)).toBe(24);
    expect(toPx('32px')).toBe(32);
    expect(toPx('bad', 48)).toBe(48);
  });

  it('clamp: clamps to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

