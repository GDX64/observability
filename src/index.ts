import type { Plugin } from 'vite';
import type { AsyncInstrumentOptions } from './types';

function toArray(pattern?: RegExp | RegExp[]): RegExp[] {
  if (!pattern) {
    return [];
  }

  return Array.isArray(pattern) ? pattern : [pattern];
}

function shouldTransform(id: string, include: RegExp[], exclude: RegExp[]): boolean {
  const isIncluded = include.length === 0 || include.some((pattern) => pattern.test(id));
  const isExcluded = exclude.some((pattern) => pattern.test(id));

  return isIncluded && !isExcluded;
}

export function asyncInstrument(options: AsyncInstrumentOptions = {}): Plugin {
  const include = toArray(options.include);
  const exclude = toArray(options.exclude);

  return {
    name: 'async-instrument',
    enforce: 'pre',
    async transform(code, id) {
      if (!shouldTransform(id, include, exclude)) {
        return null;
      }

      if (!options.transform) {
        return null;
      }

      const transformed = await options.transform(code, id);
      if (typeof transformed !== 'string' || transformed === code) {
        return null;
      }

      return {
        code: transformed,
        map: null
      };
    }
  };
}

export type { AsyncInstrumentOptions };
export default asyncInstrument;
