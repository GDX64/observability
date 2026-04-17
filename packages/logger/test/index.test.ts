import { describe, test, expect } from 'vitest';
import { Logger, LogLevel, Log, AsyncContext } from '../src/logger';

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

    await AsyncContext.create(async () => {
      logger.info('Starting async operation');
      queueMicrotask(() => {
        logger.info('This is a log from a microtask');
      });
      const value = await anotherFunction();
      logger.info(`Async operation completed with value: ${value}`);
    });

    async function anotherFunction() {
      logger.info('timer await');
      await new Promise((resolve) => setTimeout(resolve));
      await AsyncContext.create(async () => {
        logger.info('This is a log from another async context');
      });
      logger.info('after timer await');
      return 10;
    }

    expect(logsArr).toEqual([
      { message: 'Starting async operation', level: 1, span: '4' },
      { message: 'timer await', level: 1, span: '4' },
      { message: 'This is a log from a microtask', level: 1, span: null },
      {
        message: 'This is a log from another async context',
        level: 1,
        span: '4/5'
      },
      { message: 'after timer await', level: 1, span: '4' },
      {
        message: 'Async operation completed with value: 10',
        level: 1,
        span: '4'
      }
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
