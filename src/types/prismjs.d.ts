declare module 'prismjs' {
  type Grammar = unknown;
  interface PrismStatic {
    languages: Record<string, Grammar> & { tsx?: Grammar };
    highlight(code: string, grammar: Grammar, language: string): string;
  }
  const Prism: PrismStatic;
  export default Prism;
}
