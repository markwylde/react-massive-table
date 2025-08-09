import '@testing-library/jest-dom';

// Polyfill ResizeObserver for JSDOM
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-ignore
global.ResizeObserver = (global as any).ResizeObserver || RO;

// Helper to silence scroll-related warnings
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 600;
  },
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return 24;
  },
});

// Do not suppress React warnings; tests should handle act() correctly.
