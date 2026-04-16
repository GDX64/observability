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
      using __context = AsyncContext.getCurrent();
      const result = await AsyncContext.operation(doSomething());
      __context?.resume();
      const result2 = 
        await AsyncContext.operation(doSomethingElse());
      __context?.resume();
      const result3 = await AsyncContext.operation(chained
        .foo()
        .bar());
      __context?.resume();
      const nested = await AsyncContext.operation((async ()=>{
        using __context = AsyncContext.getCurrent();
        const result4 = await AsyncContext.operation(doSomethingNested());
        __context?.resume();
        return result4;
      })());
      __context?.resume();
      return result2;
    }
    `;
    const transformed = await transform({
      code
    });
    expect(transformed).toBe(expected);
  });
});
