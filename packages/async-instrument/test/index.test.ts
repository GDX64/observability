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
      function* __genFn(){
        const result = yield doSomething();
        const result2 = 
          yield doSomethingElse();
        const result3 = yield chained
          .foo()
          .bar();
        const nested = yield (async ()=>{
          function* __genFn(){
              const result4 = yield doSomethingNested();
              return result4;
          }
          return AsyncContext.run(__genFn.call(this));
        })();
        return result2;
      }
      return AsyncContext.run(__genFn.call(this));
    }
    `;
    const transformed = await transform({
      code
    });
    expect(normalizeCode(transformed)).toBe(normalizeCode(expected));
  });
});
