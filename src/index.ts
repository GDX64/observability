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

function transformAwaitLines(
  code: string,
  id: string,
  transformer: (code: string, id: string) => string
): string | null {
  const lineBreak = code.includes('\r\n') ? '\r\n' : '\n';
  const lines = code.split(/\r?\n/);
  const transformedLines: string[] = [];
  let changed = false;

  for (const line of lines) {
    if (!/\bawait\b/.test(line)) {
      transformedLines.push(line);
      continue;
    }

    const transformed = transformer(line, id);
    if (typeof transformed !== 'string' || transformed === line) {
      transformedLines.push(line);
      continue;
    }

    transformedLines.push(...transformed.split(/\r?\n/));
    changed = true;
  }

  return changed ? transformedLines.join(lineBreak) : null;
}

export function asyncInstrument(options: AsyncInstrumentOptions) {
  const include = toArray(options.include);
  const exclude = toArray(options.exclude);

  return {
    name: 'async-instrument',
    enforce: 'pre',
    transform(code, id) {
      if (!shouldTransform(id, include, exclude)) {
        return null;
      }

      const transformed = transformAwaitLines(code, id, options.transform);
      if (!transformed) {
        return null;
      }

      return {
        code: transformed,
        map: null
      };
    }
  } satisfies Plugin;
}

export type { AsyncInstrumentOptions };
export default asyncInstrument;
