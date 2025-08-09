export function getByPath(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    if (typeof cur === 'object') {
      const container = cur as Record<string | number, unknown>;
      cur = container[key as string | number];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function toPx(value: number | string | undefined, fallback = 48): number {
  if (value == null) return fallback;
  if (typeof value === 'number') return value;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
