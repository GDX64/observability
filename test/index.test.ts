import { describe, expect, it } from 'vitest';
import asyncInstrument from '../src';

describe('asyncInstrument', () => {
  it('returns transformed code when custom transform changes content', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      transform: (code) => `// instrumented\n${code}\n// instrumented`
    });

    const tsCode = [
      'const val = 1;',
      'async function hello(){',
      '  console.log(val);',
      '}',
      'const some = await hello();'
    ].join('\n');

    const result = await plugin.transform.call({} as any, tsCode, '/project/file.ts');

    const expectedResult = [
      'const val = 1;',
      'async function hello(){',
      '  console.log(val);',
      '}',
      '// instrumented',
      'const some = await hello();',
      '// instrumented'
    ].join('\n');

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

  it('transforms await expressions that span multiple lines', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      transform: (code) => `// instrumented\n${code}\n// instrumented`
    });

    const tsCode = [
      'const val = 1;',
      'async function hello(input: number) {',
      '  return input + 1;',
      '}',
      'const some = await hello({',
      '  val,',
      '  val2,',
      '  val3,',
      '});'
    ].join('\n');

    const result = await plugin.transform.call({} as any, tsCode, '/project/file.ts');

    const expectedResult = [
      'const val = 1;',
      'async function hello(input: number) {',
      '  return input + 1;',
      '}',
      '// instrumented',
      'const some = await hello({',
      '  val,',
      '  val2,',
      '  val3,',
      '});',
      '// instrumented'
    ].join('\n');

    expect(result).toEqual({
      code: expectedResult,
      map: null
    });
  });

  it('transforms await expressions with arrow callbacks that contain semicolons', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      transform: (code) => `// instrumented\n${code}\n// instrumented`
    });

    const tsCode = [
      'const some = await hello(',
      '  () => {',
      '    const value = 1;',
      '    return value;',
      '  },',
      ');'
    ].join('\n');

    const result = await plugin.transform.call({} as any, tsCode, '/project/file.ts');

    const expectedResult = [
      '// instrumented',
      'const some = await hello(',
      '  () => {',
      '    const value = 1;',
      '    return value;',
      '  },',
      ');',
      '// instrumented'
    ].join('\n');

    expect(result).toEqual({
      code: expectedResult,
      map: null
    });
  });
});
