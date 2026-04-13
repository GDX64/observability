# @glmachado/logger

A simple and lightweight logging library for TypeScript/JavaScript applications with event-based logging and span support.

## Features

- Multiple log levels (SPAN_START, SPAN_END, DEBUG, INFO, WARN, ERROR, OFF)
- Event-based logging with subscription system
- Automatic span context management with `using` statement
- Customizable prefixes
- TypeScript support with full type definitions
- Zero dependencies
- Configurable log levels

## Installation

```bash
npm install @glmachado/logger
```

## Usage

### Basic Usage

```typescript
import { logger } from '@glmachado/logger';

// Subscribe to log events
logger.subscribe((log) => {
  console.log(`${log.level}: ${log.message}`, log.span);
});

// Log messages
logger.info('Application started');
logger.debug('Debug information');
logger.warn('Warning message');
logger.error('Error occurred');
```

### Span Support

```typescript
import { logger } from '@glmachado/logger';

// Subscribe to log events
logger.subscribe((log) => {
  if (log.level === LogLevel.SPAN_START) {
    console.log(`Started span: ${log.message}`);
  } else if (log.level === LogLevel.SPAN_END) {
    console.log(`Ended span: ${log.message}`);
  } else {
    console.log(`${log.level}: ${log.message} [span: ${log.span}]`);
  }
});

// Use spans with automatic context management
using span = logger.span('operation');

// All logs within this scope automatically get the span context
logger.info('Processing data');
logger.debug('Step 1 completed');

// Span automatically ends when exiting the using block
```

### Custom Logger

```typescript
import { createLogger, LogLevel } from '@glmachado/logger';

const myLogger = createLogger({
  level: LogLevel.DEBUG,
  prefix: 'MyApp'
});

// Subscribe to logs
const unsubscribe = myLogger.subscribe((log) => {
  // Handle log event
  console.log(log);
});

myLogger.info('Hello World!');
myLogger.debug('Debug info', { userId: 123 });

// Unsubscribe when done
unsubscribe();
```

### Log Levels

- `LogLevel.SPAN_START` (-2) - Span start events
- `LogLevel.SPAN_END` (-1) - Span end events
- `LogLevel.DEBUG` (0) - Most verbose
- `LogLevel.INFO` (1) - General information
- `LogLevel.WARN` (2) - Warnings
- `LogLevel.ERROR` (3) - Errors only
- `LogLevel.OFF` (4) - No logging

### API

#### Logger Class

- `new Logger(options?: LoggerOptions)` - Create a new logger instance
- `subscribe(callback: (log: Log) => void): () => void` - Subscribe to log events, returns unsubscribe function
- `debug(message: string, span?: any)` - Log debug message
- `info(message: string, span?: any)` - Log info message
- `warn(message: string, span?: any)` - Log warning message
- `error(message: string, span?: any)` - Log error message
- `setLevel(level: LogLevel)` - Change log level
- `setPrefix(prefix: string)` - Change log prefix

#### Static Methods

- `Logger.log(log: Omit<Log, 'span'> & { span?: any }): Log` - Create a log object

#### Factory Functions

- `createLogger(options?: LoggerOptions)` - Create a new logger instance
- `logger` - Default logger instance

#### Types

- `Log` - Log object interface with `message`, `level`, and `span` properties
- `LogLevel` - Enum for log levels
- `LoggerOptions` - Options for logger configuration

## License

MIT