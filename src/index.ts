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

function findAwaitIndex(line: string): number {
  const match = /\bawait\b/.exec(line);
  return match ? match.index : -1;
}

function findAwaitBlockEnd(lines: string[], startLine: number, startColumn: number): number {
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inBlockComment = false;
  let escaped = false;

  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let inLineComment = false;
    const columnStart = lineIndex === startLine ? startColumn : 0;

    for (let column = columnStart; column < line.length; column++) {
      const char = line[column];
      const nextChar = line[column + 1] ?? '';

      if (inLineComment) {
        break;
      }

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          column += 1;
        }

        continue;
      }

      if (inSingleQuote) {
        if (!escaped && char === "'") {
          inSingleQuote = false;
        }

        escaped = !escaped && char === '\\';
        continue;
      }

      if (inDoubleQuote) {
        if (!escaped && char === '"') {
          inDoubleQuote = false;
        }

        escaped = !escaped && char === '\\';
        continue;
      }

      if (inTemplate) {
        if (!escaped && char === '`') {
          inTemplate = false;
        }

        escaped = !escaped && char === '\\';
        continue;
      }

      escaped = false;

      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        continue;
      }

      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        column += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }

      if (char === '`') {
        inTemplate = true;
        continue;
      }

      if (char === '(') {
        parenDepth += 1;
        continue;
      }

      if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        continue;
      }

      if (char === '{') {
        braceDepth += 1;
        continue;
      }

      if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }

      if (char === '[') {
        bracketDepth += 1;
        continue;
      }

      if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }

      if (char === ';' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
        return lineIndex;
      }
    }
  }

  return lines.length - 1;
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

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const awaitIndex = findAwaitIndex(line);
    if (awaitIndex === -1) {
      transformedLines.push(line);
      continue;
    }

    const endIndex = findAwaitBlockEnd(lines, index, awaitIndex);

    const awaitBlock = lines.slice(index, endIndex + 1).join(lineBreak);
    const transformed = transformer(awaitBlock, id);
    if (typeof transformed !== 'string' || transformed === awaitBlock) {
      transformedLines.push(...lines.slice(index, endIndex + 1));
      index = endIndex;
      continue;
    }

    transformedLines.push(...transformed.split(/\r?\n/));
    changed = true;
    index = endIndex;
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
