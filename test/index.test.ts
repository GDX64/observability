import { describe, expect, it } from 'vitest';
import asyncInstrument from '../src';
import { format } from 'prettier';

describe('asyncInstrument', () => {
  it('returns transformed code when custom transform changes content', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      transform: (code) => `// instrumented\n${code}\n// instrumented`
    });

    let tsCode = `
    const val = 1;
    async function hello(){
      console.log(val);
    }
    const some = await hello(); 
    `;

    tsCode = await format(tsCode, { parser: 'typescript' });
    const result = await plugin.transform.call({} as any, tsCode, '/project/file.ts');

    let expectedResult = `
    const val = 1;
    async function hello(){
      console.log(val);
    }
    // instrumented
    const some = await hello();
    // instrumented
    `;

    expectedResult = await format(expectedResult, { parser: 'typescript' });

    expect(result).toEqual({
      code: expectedResult,
      map: null
    });
  });

  it('skips files excluded by pattern', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      exclude: /skip\.ts$/,
      transform: (code) => `${code}\n// instrumented`
    });

    const result = await plugin.transform.call({} as any, 'const value = 1;', '/project/skip.ts');

    expect(result).toBeNull();
  });
});
