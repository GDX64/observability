import { describe, expect, it } from 'vitest';
import { transform } from '../src';

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
      using context = getAsyncContext();
      const result = await doSomething();
      context.resume();
      const result2 = 
        await doSomethingElse();
      context.resume();
      const result3 = await chained
        .foo()
        .bar();
      context.resume();
      const nested = await (async ()=>{
        using context = getAsyncContext();
        const result4 = await doSomethingNested();
        context.resume();
        return result4;
      })();
      context.resume();
      return result2;
    }
    `;
    const transformed = await transform({
      code,
      contextName: 'context',
      getFunctionName: 'getAsyncContext',
    });
    expect(transformed).toBe(expected);
  });
});
