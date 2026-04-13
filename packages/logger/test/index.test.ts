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
    // span must support the using interface
    const span = logger.span('test-span');

    //when created the span becomes active
    //so we dont need to pass it explicitly
    logger.info('This is a log with a span');

    // Explicitly dispose to ensure SPAN_END is emitted
    span[Symbol.dispose]();

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
});

function collectLogs(logger: Logger): Log[] {
  const logs: Log[] = [];
  logger.subscribe((log) => {
    logs.push(log);
  });
  return logs;
}
