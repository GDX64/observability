import ts from 'typescript';
import { Plugin } from 'vite';

export interface TransformOptions {
  code: string;
  contextName?: string;
  getFunctionName?: string;
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

function getIndentation(line: string): string {
  const matched = line.match(/^\s*/);
  return matched?.[0] ?? '';
}

function detectIndentUnit(lines: string[]): string {
  for (const line of lines) {
    const matched = line.match(/^(\s+)\S/);
    if (!matched) {
      continue;
    }

    const indentation = matched[1];
    if (indentation.includes('\t')) {
      return '\t';
    }

    return ' '.repeat(Math.min(indentation.length, 2));
  }

  return '  ';
}

type FunctionLikeWithBody =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

function hasAsyncModifier(node: FunctionLikeWithBody): boolean {
  return !!node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
}

function findNearestAsyncFunction(node: ts.Node): FunctionLikeWithBody | null {
  let current: ts.Node | undefined = node.parent;

  while (current && !ts.isSourceFile(current)) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current)) &&
      hasAsyncModifier(current)
    ) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function instrumentAsyncAwait(code: string, contextName: string, getFunctionName: string): string {
  const sourceFile = ts.createSourceFile(
    'inline.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const lineBreak = code.includes('\r\n') ? '\r\n' : '\n';
  const lines = code.split(/\r?\n/);
  const indentUnit = detectIndentUnit(lines);

  const beforeLineInsertions = new Map<number, string[]>();
  const afterLineInsertions = new Map<number, string[]>();
  const instrumentedFunctionLines = new Set<number>();
  const resumedStatementLines = new Set<number>();

  const addBeforeLine = (lineIndex: number, content: string) => {
    const existing = beforeLineInsertions.get(lineIndex);
    if (existing) {
      existing.push(content);
      return;
    }

    beforeLineInsertions.set(lineIndex, [content]);
  };

  const addAfterLine = (lineIndex: number, content: string) => {
    const existing = afterLineInsertions.get(lineIndex);
    if (existing) {
      existing.push(content);
      return;
    }

    afterLineInsertions.set(lineIndex, [content]);
  };

  const visit = (node: ts.Node) => {
    if (ts.isAwaitExpression(node)) {
      const statement = findEnclosingStatement(node);
      const asyncFunction = findNearestAsyncFunction(node);

      if (statement && asyncFunction && asyncFunction.body && ts.isBlock(asyncFunction.body)) {
        const statementStart = sourceFile.getLineAndCharacterOfPosition(
          statement.getStart(sourceFile)
        ).line;
        const statementEnd = sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line;

        if (!resumedStatementLines.has(statementEnd)) {
          resumedStatementLines.add(statementEnd);
          const statementIndent = getIndentation(lines[statementStart] ?? '');
          addAfterLine(statementEnd, `${statementIndent}${contextName}.resume();`);
        }

        const functionBody = asyncFunction.body;
        let contextInsertLine: number;
        let contextIndentation: string;

        if (functionBody.statements.length > 0) {
          const firstStatement = functionBody.statements[0];
          contextInsertLine = sourceFile.getLineAndCharacterOfPosition(
            firstStatement.getStart(sourceFile)
          ).line;
          contextIndentation = getIndentation(lines[contextInsertLine] ?? '');
        } else {
          contextInsertLine = sourceFile.getLineAndCharacterOfPosition(functionBody.getEnd()).line;
          const bodyStartLine = sourceFile.getLineAndCharacterOfPosition(
            functionBody.getStart(sourceFile)
          ).line;
          const bodyIndentation = getIndentation(lines[bodyStartLine] ?? '');
          contextIndentation = `${bodyIndentation}${indentUnit}`;
        }

        if (!instrumentedFunctionLines.has(contextInsertLine)) {
          instrumentedFunctionLines.add(contextInsertLine);
          addBeforeLine(
            contextInsertLine,
            `${contextIndentation}using ${contextName} = ${getFunctionName}();`
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (beforeLineInsertions.size === 0 && afterLineInsertions.size === 0) {
    return code;
  }

  const transformedLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const before = beforeLineInsertions.get(index);
    if (before) {
      transformedLines.push(...before);
    }

    transformedLines.push(lines[index]);

    const after = afterLineInsertions.get(index);
    if (after) {
      transformedLines.push(...after);
    }
  }

  return transformedLines.join(lineBreak);
}

export async function transform(options: TransformOptions): Promise<string> {
  const contextName = options.contextName ?? 'context';
  const getFunctionName = options.getFunctionName ?? 'getAsyncContext';

  return instrumentAsyncAwait(options.code, contextName, getFunctionName);
}

export function asyncInstrumentPlugin(args: {
  contextName: string;
  getFunctionName: string;
}): Plugin {
  return {
    name: 'vite-plugin-async-instrument',
    transform(code, id) {
      if (id.endsWith('.ts')) {
        return transform({
          contextName: args.contextName,
          getFunctionName: args.getFunctionName,
          code
        });
      }
    }
  };
}
