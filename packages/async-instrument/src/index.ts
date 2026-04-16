import ts from 'typescript';
import { Plugin } from 'vite';

export interface TransformOptions {
  code: string;
  contextName?: string;
  getFunctionName?: string;
  operationFunctionName?: string;
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

function instrumentAsyncAwait(
  code: string,
  contextName: string,
  getFunctionName: string,
  operationFunctionName: string
): string {
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
  const instrumentedAwaits: ts.AwaitExpression[] = [];

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
        instrumentedAwaits.push(node);

        const statementStart = sourceFile.getLineAndCharacterOfPosition(
          statement.getStart(sourceFile)
        ).line;
        const statementEnd = sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line;

        if (!resumedStatementLines.has(statementEnd)) {
          resumedStatementLines.add(statementEnd);
          const statementIndent = getIndentation(lines[statementStart] ?? '');
          addAfterLine(statementEnd, `${statementIndent}${contextName}?.resume();`);
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

  if (
    beforeLineInsertions.size === 0 &&
    afterLineInsertions.size === 0 &&
    instrumentedAwaits.length === 0
  ) {
    return code;
  }

  const awaitSet = new Set(instrumentedAwaits);
  const awaitChildren = new Map<ts.AwaitExpression, ts.AwaitExpression[]>();
  const topLevelAwaits: ts.AwaitExpression[] = [];

  for (const awaitNode of instrumentedAwaits) {
    let parentAwait: ts.AwaitExpression | null = null;
    let current: ts.Node | undefined = awaitNode.parent;

    while (current && !ts.isSourceFile(current)) {
      if (ts.isAwaitExpression(current) && awaitSet.has(current)) {
        parentAwait = current;
        break;
      }

      current = current.parent;
    }

    if (parentAwait) {
      const existingChildren = awaitChildren.get(parentAwait);
      if (existingChildren) {
        existingChildren.push(awaitNode);
      } else {
        awaitChildren.set(parentAwait, [awaitNode]);
      }
      continue;
    }

    topLevelAwaits.push(awaitNode);
  }

  const sortByStart = (nodes: ts.AwaitExpression[]) =>
    nodes.sort((left, right) => left.getStart(sourceFile) - right.getStart(sourceFile));

  sortByStart(topLevelAwaits);
  for (const children of awaitChildren.values()) {
    sortByStart(children);
  }

  const renderRangeWithAwaits = (
    start: number,
    end: number,
    awaitNodes: ts.AwaitExpression[]
  ): string => {
    if (awaitNodes.length === 0) {
      return code.slice(start, end);
    }

    let cursor = start;
    let output = '';

    for (const awaitNode of awaitNodes) {
      const awaitStart = awaitNode.getStart(sourceFile);
      const awaitEnd = awaitNode.getEnd();

      output += code.slice(cursor, awaitStart);

      const expressionStart = awaitNode.expression.getStart(sourceFile);
      const expressionEnd = awaitNode.expression.getEnd();
      const nestedAwaits = awaitChildren.get(awaitNode) ?? [];
      const renderedExpression = renderRangeWithAwaits(
        expressionStart,
        expressionEnd,
        nestedAwaits
      );

      output += `await ${operationFunctionName}(${renderedExpression})`;
      cursor = awaitEnd;
    }

    output += code.slice(cursor, end);
    return output;
  };

  const transformedCode = renderRangeWithAwaits(0, code.length, topLevelAwaits);

  const transformedLines: string[] = [];
  const transformedCodeLines = transformedCode.split(/\r?\n/);

  for (let index = 0; index < transformedCodeLines.length; index += 1) {
    const before = beforeLineInsertions.get(index);
    if (before) {
      transformedLines.push(...before);
    }

    transformedLines.push(transformedCodeLines[index]);

    const after = afterLineInsertions.get(index);
    if (after) {
      transformedLines.push(...after);
    }
  }

  return transformedLines.join(lineBreak);
}

export async function transform(options: TransformOptions): Promise<string> {
  const contextName = options.contextName ?? '__context';
  const getFunctionName = options.getFunctionName ?? 'AsyncContext.getCurrent';
  const operationFunctionName = options.operationFunctionName ?? 'AsyncContext.operation';

  return instrumentAsyncAwait(options.code, contextName, getFunctionName, operationFunctionName);
}

export function asyncInstrumentPlugin(args: {
  contextName: string;
  getFunctionName: string;
  operationFunctionName?: string;
}): Plugin {
  return {
    name: 'vite-plugin-async-instrument',
    transform(code, id) {
      if (id.endsWith('.ts')) {
        return transform({
          contextName: args.contextName,
          getFunctionName: args.getFunctionName,
          operationFunctionName: args.operationFunctionName,
          code
        });
      }
    }
  };
}
