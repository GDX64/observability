import ts from 'typescript';
import { Plugin } from 'vite';

export interface TransformOptions {
  code: string;
  contextName?: string;
  getFunctionName?: string;
  operationFunctionName?: string;
}

type AsyncFunctionLikeWithBlock =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

function hasAsyncModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function isAsyncFunctionWithBlock(node: ts.Node): node is AsyncFunctionLikeWithBlock {
  return isFunctionLike(node) && !!node.body && ts.isBlock(node.body) && hasAsyncModifier(node);
}

function hasAwaitInOwnBlock(block: ts.Block): boolean {
  let found = false;

  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }

    if (isFunctionLike(node)) {
      return;
    }

    if (ts.isAwaitExpression(node)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  for (const statement of block.statements) {
    visit(statement);
    if (found) {
      break;
    }
  }

  return found;
}

function dottedNameToExpression(name: string): ts.Expression {
  const parts = name.split('.').filter(Boolean);
  if (parts.length === 0) {
    return ts.factory.createIdentifier('AsyncContext.run');
  }

  let expression: ts.Expression = ts.factory.createIdentifier(parts[0]);
  for (let index = 1; index < parts.length; index += 1) {
    expression = ts.factory.createPropertyAccessExpression(expression, parts[index]);
  }

  return expression;
}

function updateFunctionBody(
  node: AsyncFunctionLikeWithBlock,
  body: ts.Block
): AsyncFunctionLikeWithBlock {
  if (ts.isFunctionDeclaration(node)) {
    return ts.factory.updateFunctionDeclaration(
      node,
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.typeParameters,
      node.parameters,
      node.type,
      body
    );
  }

  if (ts.isFunctionExpression(node)) {
    return ts.factory.updateFunctionExpression(
      node,
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.typeParameters,
      node.parameters,
      node.type,
      body
    );
  }

  if (ts.isArrowFunction(node)) {
    return ts.factory.updateArrowFunction(
      node,
      node.modifiers,
      node.typeParameters,
      node.parameters,
      node.type,
      node.equalsGreaterThanToken,
      body
    );
  }

  return ts.factory.updateMethodDeclaration(
    node,
    node.modifiers,
    node.asteriskToken,
    node.name,
    node.questionToken,
    node.typeParameters,
    node.parameters,
    node.type,
    body
  );
}

function lowerAwaitToYield(block: ts.Block, context: ts.TransformationContext): ts.Block {
  const lowerAwaitVisitor = (node: ts.Node): ts.Node => {
    if (isFunctionLike(node)) {
      return node;
    }

    if (ts.isAwaitExpression(node)) {
      const expression = ts.visitNode(node.expression, lowerAwaitVisitor) as ts.Expression;
      return ts.factory.createYieldExpression(undefined, expression);
    }

    return ts.visitEachChild(node, lowerAwaitVisitor, context);
  };

  const loweredStatements = block.statements.map(
    (statement) => ts.visitNode(statement, lowerAwaitVisitor) as ts.Statement
  );

  return ts.factory.updateBlock(block, loweredStatements);
}

function instrumentAsyncAwait(code: string, runFunctionName: string): string {
  const sourceFile = ts.createSourceFile(
    'inline.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visitor: ts.Visitor = (node) => {
      if (!isAsyncFunctionWithBlock(node)) {
        return ts.visitEachChild(node, visitor, context);
      }

      const transformedBody = ts.visitEachChild(node.body, visitor, context) as ts.Block;
      if (!hasAwaitInOwnBlock(transformedBody)) {
        return updateFunctionBody(node, transformedBody);
      }

      const loweredBody = lowerAwaitToYield(transformedBody, context);
      const generatorDeclaration = ts.factory.createFunctionDeclaration(
        undefined,
        ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
        '__genFn',
        undefined,
        [],
        undefined,
        loweredBody
      );

      const runExpression = dottedNameToExpression(runFunctionName);
      const runCall = ts.factory.createReturnStatement(
        ts.factory.createCallExpression(runExpression, undefined, [
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('__genFn'),
              ts.factory.createIdentifier('call')
            ),
            undefined,
            [ts.factory.createThis()]
          )
        ])
      );

      const instrumentedBody = ts.factory.updateBlock(transformedBody, [
        generatorDeclaration,
        runCall
      ]);
      return updateFunctionBody(node, instrumentedBody);
    };

    return (inputSourceFile) => ts.visitNode(inputSourceFile, visitor) as ts.SourceFile;
  };

  const transformed = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = transformed.transformed[0];
  transformed.dispose();

  return ts
    .createPrinter({
      removeComments: false,
      newLine: ts.NewLineKind.LineFeed
    })
    .printFile(transformedSourceFile);
}

export async function transform(options: TransformOptions): Promise<string> {
  const runFunctionName = options.operationFunctionName ?? 'AsyncContext.run';

  return instrumentAsyncAwait(options.code, runFunctionName);
}

export function asyncInstrumentPlugin(args?: { ignore: RegExp }): Plugin {
  return {
    name: 'vite-plugin-async-instrument',
    transform(code, id) {
      if (args?.ignore && args.ignore.test(id)) {
        return null;
      }
      if (id.endsWith('.ts')) {
        return transform({
          code
        });
      }
    }
  };
}
