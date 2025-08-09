declare module 'chance' {
  type ColorFormat = 'hex' | 'name' | 'rgb' | '0x';
  interface ChanceOptions {
    seed?: string | number;
  }
  interface IntegerOptions {
    min?: number;
    max?: number;
  }
  interface ColorOptions {
    format?: ColorFormat;
  }
  class Chance {
    constructor(seed?: string | number);
    first(): string;
    last(): string;
    pick<T>(arr: ReadonlyArray<T | null>): T | null;
    color(options?: ColorOptions): string;
    integer(options?: IntegerOptions): number;
  }
  export default Chance;
}
