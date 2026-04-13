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

export interface Span {
  id: string;
  name: string;
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private subscribers: Array<(log: Log) => void> = [];
  private activeSpan: Span | null = null;
  private spanStack: Span[] = [];
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

  private emit(log: Log): void {
    this.subscribers.forEach((callback) => callback(log));
  }

  private getCurrentSpanId(): string | null {
    if (!this.activeSpan) return null;
    // Build the full path by walking up the stack
    const path: string[] = [];
    for (let i = 0; i < this.spanStack.length; i++) {
      path.push(this.spanStack[i].id);
    }
    return path.join('/');
  }

  span(name: string): Span & Disposable {
    const baseSpanId = (++Logger.spanCounter).toString();
    const parentSpanId = this.getCurrentSpanId();
    const fullSpanId = parentSpanId ? `${parentSpanId}/${baseSpanId}` : baseSpanId;
    const span: Span & Disposable = {
      id: baseSpanId,
      name,
      [Symbol.dispose]: () => {
        // Emit span end
        const endLog = Logger.log({
          message: name,
          level: LogLevel.SPAN_END,
          span: fullSpanId
        });
        this.emit(endLog);

        // Pop from stack
        this.spanStack.pop();
        this.activeSpan = this.spanStack[this.spanStack.length - 1] || null;
      }
    };

    // Push to stack and set as active
    this.spanStack.push(span);
    this.activeSpan = span;

    // Emit span start
    const startLog = Logger.log({
      message: name,
      level: LogLevel.SPAN_START,
      span: fullSpanId
    });
    this.emit(startLog);

    return span;
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
