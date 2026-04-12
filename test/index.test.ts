import { describe, expect, it } from 'vitest';
import asyncInstrument from '../src';

async function runTransform(plugin: ReturnType<typeof asyncInstrument>, code: string, id: string) {
  const hook = plugin.transform;
  if (!hook) {
    return null;
  }

  if (typeof hook === 'function') {
    return hook.call({} as never, code, id);
  }

  return hook.handler.call({} as never, code, id);
}

describe('asyncInstrument', () => {
  it('creates a plugin with expected metadata', () => {
    const plugin = asyncInstrument();

    expect(plugin.name).toBe('async-instrument');
    expect(plugin.enforce).toBe('pre');
    expect(typeof plugin.transform).toBe('function');
  });

  it('returns transformed code when custom transform changes content', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      transform: (code) => `${code}\n// instrumented`
    });

    const result = await runTransform(plugin, 'const value = 1;', '/project/file.ts');

    expect(result).toEqual({
      code: 'const value = 1;\n// instrumented',
      map: null
    });
  });

  it('skips files excluded by pattern', async () => {
    const plugin = asyncInstrument({
      include: /\.ts$/,
      exclude: /skip\.ts$/,
      transform: (code) => `${code}\n// instrumented`
    });

    const result = await runTransform(plugin, 'const value = 1;', '/project/skip.ts');

    expect(result).toBeNull();
  });
});
