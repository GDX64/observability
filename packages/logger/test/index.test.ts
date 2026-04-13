import { describe, test, expect } from 'vitest';
import { Logger, LogLevel, Log } from '../src';

describe('Logger', () => {
  test('basic logger', () => {
    const logger = new Logger();
    const logsArr = collectLogs(logger);
    logger.info('Hello, World!');

    expect(logsArr).toEqual([
      Logger.log({
        message: 'Hello, World!',
        level: LogLevel.INFO,
        span: null
      })
    ]);
  });

  test('log with span', () => {
    const logger = new Logger();
    const logsArr = collectLogs(logger);
    function testSpan() {
      // span must support the using interface
      using span = logger.span('test-span');

      //when created the span becomes active
      //so we dont need to pass it explicitly
      logger.info('This is a log with a span');
      return span;
    }

    const span = testSpan();

    expect(logsArr).toEqual([
      Logger.log({
        message: 'test-span',
        level: LogLevel.SPAN_START,
        span: span.id
      }),
      Logger.log({
        message: 'This is a log with a span',
        level: LogLevel.INFO,
        span: span.id
      }),
      Logger.log({
        message: 'test-span',
        level: LogLevel.SPAN_END,
        span: span.id
      })
    ]);
  });

  test('nested spans', () => {
    const logger = new Logger();
    const logsArr = collectLogs(logger);

    function testNestedSpans() {
      using parentSpan = logger.span('parent-operation');
      logger.info('Starting parent operation');

      using childSpan = logger.span('child-operation');
      logger.info('Processing child operation');

      return { parentSpan, childSpan };
    }

    const { parentSpan, childSpan } = testNestedSpans();

    expect(logsArr).toEqual([
      // Parent span starts
      Logger.log({
        message: 'parent-operation',
        level: LogLevel.SPAN_START,
        span: parentSpan.id
      }),
      // Parent operation log
      Logger.log({
        message: 'Starting parent operation',
        level: LogLevel.INFO,
        span: parentSpan.id
      }),
      // Child span starts
      Logger.log({
        message: 'child-operation',
        level: LogLevel.SPAN_START,
        span: `${parentSpan.id}/${childSpan.id}`
      }),
      // Child operation log
      Logger.log({
        message: 'Processing child operation',
        level: LogLevel.INFO,
        span: `${parentSpan.id}/${childSpan.id}`
      }),
      // Child span ends
      Logger.log({
        message: 'child-operation',
        level: LogLevel.SPAN_END,
        span: `${parentSpan.id}/${childSpan.id}`
      }),
      // Parent span ends
      Logger.log({
        message: 'parent-operation',
        level: LogLevel.SPAN_END,
        span: parentSpan.id
      })
    ]);
  });

  test('async spans', async () => {
    const logger = new Logger();
    const logsArr = collectLogs(logger);

    async function testAsyncSpan() {
      using span = logger.span('async-operation');
      await nestedAsyncFunction();
      return span;
    }

    async function nestedAsyncFunction() {
      // Simulate async work
      logger.info('Starting async operation');
      queueMicrotask(() => {
        logger.info('log with no span');
      });
      const current = logger.popSpan()!;
      await new Promise((resolve) => setTimeout(resolve, 10));
      logger.resume(current);

      logger.info('Async operation completed');
    }

    const span = await testAsyncSpan();

    expect(logsArr).toEqual([
      Logger.log({
        message: 'async-operation',
        level: LogLevel.SPAN_START,
        span: span.id
      }),
      Logger.log({
        message: 'Starting async operation',
        level: LogLevel.INFO,
        span: span.id
      }),
      Logger.log({
        message: 'log with no span',
        level: LogLevel.INFO,
        span: null
      }),
      Logger.log({
        message: 'Async operation completed',
        level: LogLevel.INFO,
        span: span.id
      }),
      Logger.log({
        message: 'async-operation',
        level: LogLevel.SPAN_END,
        span: span.id
      })
    ]);
  });
});

function collectLogs(logger: Logger): Log[] {
  const logs: Log[] = [];
  logger.subscribe((log) => {
    logs.push(log);
  });
  return logs;
}
