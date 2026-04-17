import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { transform } from '../src';

function normalizeCode(source: string): string {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  return ts
    .createPrinter({
      removeComments: false,
      newLine: ts.NewLineKind.LineFeed
    })
    .printFile(sourceFile)
    .trim();
}

describe('asyncInstrument', () => {
  it('returns transformed code when custom transform changes content', async () => {
    const code = `
    async function foo(){
      const result = await doSomething();
      const result2 = 
        await doSomethingElse();
      const result3 = await chained
        .foo()
        .bar();
      const nested = await (async ()=>{
        const result4 = await doSomethingNested();
        return result4;
      })();
      return result2;
    }
    `;
    const expected = `
    async function foo(){
      const result = await AsyncContext.operation(()=>doSomething());
      const result2 = 
        await AsyncContext.operation(()=>doSomethingElse());
      const result3 = await AsyncContext.operation(()=>chained
        .foo()
        .bar());
      const nested = await AsyncContext.operation(()=>(async ()=>{
        const result4 = await AsyncContext.operation(()=>doSomethingNested());
        return result4;
      })());
      return result2;
    }
    `;
    const transformed = await transform({
      code
    });
    expect(normalizeCode(transformed)).toBe(normalizeCode(expected));
  });
});
