export enum LogLevel {
  SPAN_START = -2,
  SPAN_END = -1,
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4
}

export interface Log {
  message: string;
  level: LogLevel;
  span: string | null;
}

export class Span implements Disposable {
  constructor(
    private logger: Logger,
    public id: string,
    public name: string,
    public fullSpanId: string
  ) {}

  [Symbol.dispose](): void {
    const endLog = Logger.log({
      message: this.name,
      level: LogLevel.SPAN_END,
      span: this.fullSpanId
    });
    this.logger.emit(endLog);
    this.logger.spanStack.pop();
  }

  resume(): void {
    this.logger.resume(this);
  }
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private subscribers: Array<(log: Log) => void> = [];
  spanStack: Span[] = [];
  private static spanCounter = 0;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
  }

  static log(log: Omit<Log, 'span'> & { span?: string | null }): Log {
    return {
      message: log.message,
      level: log.level,
      span: log.span ?? null
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  emit(log: Log): void {
    this.subscribers.forEach((callback) => callback(log));
  }

  private getCurrentSpanId(): string | null {
    return this.currentSpan?.fullSpanId || null;
  }

  createSpan<T>(name: string, callback: () => T): T {
    const span = this.span(name);
    try {
      return callback();
    } finally {
      span[Symbol.dispose]();
    }
  }

  async asyncSpan<T>(name: string, callback: () => Promise<T>): Promise<T> {
    const span = this.span(name);
    const result = AsyncContext.create(callback);
    span[Symbol.dispose]();
    return result;
  }

  span(name: string): Span {
    const baseSpanId = (++Logger.spanCounter).toString();
    const parentSpanId = this.getCurrentSpanId();
    const fullSpanId = parentSpanId ? `${parentSpanId}/${baseSpanId}` : baseSpanId;
    const span = new Span(this, baseSpanId, name, fullSpanId);

    // Push to stack
    this.spanStack.push(span);

    // Emit span start
    const startLog = Logger.log({
      message: name,
      level: LogLevel.SPAN_START,
      span: fullSpanId
    });
    this.emit(startLog);

    return span;
  }

  get currentSpan(): Span | null {
    const context = AsyncContext.getCurrent();
    if (context) {
      return context.span;
    }
    return this.spanStack[this.spanStack.length - 1] || null;
  }

  resume(span: Span | null): void {
    // Ensure the span is in the stack
    if (span && !this.spanStack.includes(span)) {
      this.spanStack.push(span);
    }
  }

  popSpan(): Span | null {
    const popped = this.spanStack.pop();
    return popped || null;
  }

  subscribe(callback: (log: Log) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const log = Logger.log({
        message: `${this.prefix ? `[${this.prefix}] ` : ''}${message}`,
        level: LogLevel.DEBUG,
        span: this.getCurrentSpanId()
      });
      this.emit(log);
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const log = Logger.log({
        message: `${this.prefix ? `[${this.prefix}] ` : ''}${message}`,
        level: LogLevel.INFO,
        span: this.getCurrentSpanId()
      });
      this.emit(log);
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const log = Logger.log({
        message: `${this.prefix ? `[${this.prefix}] ` : ''}${message}`,
        level: LogLevel.WARN,
        span: this.getCurrentSpanId()
      });
      this.emit(log);
    }
  }

  error(message: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const log = Logger.log({
        message: `${this.prefix ? `[${this.prefix}] ` : ''}${message}`,
        level: LogLevel.ERROR,
        span: this.getCurrentSpanId()
      });
      this.emit(log);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
}

// Default logger instance
export const logger = new Logger();

// Factory function for creating loggers
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

let currentContext: AsyncContext | null = null;

export class AsyncContext implements Disposable {
  parentContext: AsyncContext | null = null;
  isInAwaitedExpression = false;
  constructor(public span: Span) {
    if (currentContext) {
      this.parentContext = currentContext;
    } else {
      this.parentContext = null;
    }
  }

  static create<T>(fn: () => Promise<T>): Promise<T> {
    const span = logger.span('async-context');
    const context = new AsyncContext(span);
    currentContext = context;
    return fn().finally(() => {
      currentContext = context.parentContext;
    });
  }

  static async run(generator: Generator): Promise<any> {
    const context = currentContext;
    let result: any;
    while (true) {
      currentContext = context;
      const { value, done } = generator.next(result);
      currentContext = null;
      if (done) {
        return value;
      }
      result = await value;
    }
  }

  static getCurrent(): AsyncContext | null {
    return currentContext;
  }

  resume() {
    currentContext = this;
  }

  pause() {
    currentContext = null;
  }

  [Symbol.dispose](): void {
    this.pause();
  }
}

declare const self: any;
if (typeof self !== 'undefined') {
  self.AsyncContext = AsyncContext;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).AsyncContext = AsyncContext;
}
