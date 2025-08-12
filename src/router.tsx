import * as React from 'react';

export type Route = {
  key: string;
  title: string;
  element: React.ReactNode;
};

export function useHashRoute(defaultKey: string) {
  const [key, setKey] = React.useState<string>(defaultKey);
  const [variant, setVariant] = React.useState<number>(0);

  React.useEffect(() => {
    const parse = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const parts = hash.split('/').filter(Boolean);
      const nextKey = parts[0] || defaultKey;
      const idx = parts[1] ? Number(parts[1]) : 0;
      setKey(nextKey);
      setVariant(Number.isFinite(idx) ? Math.max(0, idx) : 0);
    };
    window.addEventListener('hashchange', parse);
    parse();
    return () => window.removeEventListener('hashchange', parse);
  }, [defaultKey]);

  const navigate = React.useCallback((nextKey: string, nextVariant?: number) => {
    const v = typeof nextVariant === 'number' ? `/${nextVariant}` : '';
    const next = `#/${nextKey}${v}`;
    if (window.location.hash !== next) window.location.hash = next;
  }, []);

  return { key, variant, navigate };
}
