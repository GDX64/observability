import type { Plugin } from 'vite';
import ts from 'typescript';
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

interface LineRange {
  start: number;
  end: number;
}

function findEnclosingStatement(node: ts.Node): ts.Statement | null {
  let current: ts.Node | undefined = node;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isStatement(current)) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function collectAwaitStatementRanges(code: string): LineRange[] {
  const sourceFile = ts.createSourceFile(
    'inline.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const ranges: LineRange[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isAwaitExpression(node)) {
      const statement = findEnclosingStatement(node);
      if (statement) {
        const start = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line;
        const end = sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line;
        ranges.push({ start, end });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (ranges.length === 0) {
    return ranges;
  }

  ranges.sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: LineRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }

    last.end = Math.max(last.end, range.end);
  }

  return merged;
}

function transformAwaitLines(
  code: string,
  id: string,
  transformer: (code: string, id: string) => string
): string | null {
  const lineBreak = code.includes('\r\n') ? '\r\n' : '\n';
  const lines = code.split(/\r?\n/);
  const ranges = collectAwaitStatementRanges(code);
  const transformedLines: string[] = [];
  let changed = false;
  let rangeIndex = 0;

  for (let index = 0; index < lines.length; index++) {
    while (rangeIndex < ranges.length && ranges[rangeIndex].end < index) {
      rangeIndex += 1;
    }

    const range = ranges[rangeIndex];
    if (!range || range.start !== index) {
      transformedLines.push(lines[index]);
      continue;
    }

    const awaitBlock = lines.slice(range.start, range.end + 1).join(lineBreak);
    const transformed = transformer(awaitBlock, id);
    if (typeof transformed !== 'string' || transformed === awaitBlock) {
      transformedLines.push(...lines.slice(range.start, range.end + 1));
      index = range.end;
      rangeIndex += 1;
      continue;
    }

    transformedLines.push(...transformed.split(/\r?\n/));
    changed = true;
    index = range.end;
    rangeIndex += 1;
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
