---
name: coder
description: you code
# tools: ['vscode', 'execute', 'read', 'agent', 'edit', 'search', 'web', 'todo'] # specify the tools this agent can use. If not set, all enabled tools are allowed.
---

# Async Instrument Monorepo Architecture

## Overview

This is a monorepo containing packages for async instrumentation and logging, along with a test application demonstrating their usage. The project uses npm workspaces for package management and TypeScript composite mode for efficient builds.

## Structure

### Root Configuration

- `package.json`: Root package with workspaces configuration
- `tsconfig.common.json`: Shared TypeScript configuration
- `tsconfig.json`: Composite project references

### Packages (`/packages`)

#### async-instrument

**Purpose**: Vite plugin for automatic instrumentation of async operations using AST transformation.

**Key Features**:

- Transforms `await` expressions to include span tracking
- Uses TypeScript Compiler API for AST parsing
- Integrates with the logger package for span management

**Files**:

- `src/index.ts`: Main plugin implementation with transform hooks
- `test/index.test.ts`: Unit tests for transformation logic
- `package.json`: Peer dependencies on Vite and TypeScript

#### logger

**Purpose**: Event-based logging library with hierarchical span support for tracing async operations.

**Key Features**:

- Disposable spans with automatic cleanup
- Hierarchical span IDs (e.g., "parent/child")
- Event subscription system
- Manual span management with `popSpan()` and `resume()`

**Files**:

- `src/index.ts`: Logger class with span management
- `test/index.test.ts`: Tests for logging, spans, and async scenarios
- `package.json`: Pure TypeScript library

### Apps (`/apps`)

#### test-app

**Purpose**: React-based todo application demonstrating the integration of async-instrument and logger packages.

**Key Features**:

- Todo CRUD operations with IndexedDB (Dexie)
- Manual logging instrumentation in actions
- Shadcn/ui components with Tailwind CSS
- Automatic await instrumentation via Vite plugin

**Files**:

- `src/App.tsx`: Main component with instrumented actions
- `src/db.ts`: Dexie database schema
- `src/main.tsx`: App entry point
- `vite.config.ts`: Vite config with async-instrument plugin

## Build System

### TypeScript

- Composite mode with project references for incremental builds
- Shared configuration in `tsconfig.common.json`
- Separate compilation for each package

### Vite

- Used for the test app build
- Integrates the async-instrument plugin for transformation

### Testing

- Vitest for unit testing
- Tests run in each package directory

## Dependencies

### Shared

- TypeScript ^5.8.3
- Vitest ^3.1.1

### async-instrument

- Peer: Vite ^6.3.3, TypeScript ^5.8.3

### logger

- None (pure TypeScript)

### test-app

- React ^18.3.1
- Dexie ^4.0.10
- Shadcn/ui components
- Tailwind CSS ^3.4.17

## Architecture Patterns

### Span Management

- Spans are created with `logger.span(name)` returning a Disposable
- Automatic cleanup via `using` keyword or manual disposal
- Hierarchical IDs built from stack traversal
- Manual control with `popSpan()` and `resume()` for async contexts

### Event-Based Logging

- Logger emits events for all log levels and span operations
- Subscribers can listen to all logging activity
- Decoupled logging allows flexible consumption (console, files, etc.)

### AST Transformation

- Vite plugin transforms source code at build time
- Identifies await expressions and wraps them with span logic
- Preserves source maps and TypeScript types

## Development Workflow

1. Packages are developed independently with their own tests
2. Test app demonstrates real-world usage
3. Changes to packages automatically available via workspace linking
4. Composite TypeScript builds ensure fast incremental compilation

## Key Integration Points

- Logger spans provide context for async operations
- Async-instrument plugin automatically instruments awaits to create spans
- Manual logging in app code provides business-level insights
- Combined instrumentation gives full visibility into async execution flow
