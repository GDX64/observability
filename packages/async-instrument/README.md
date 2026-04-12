# @glmachado/async-instrument

Boilerplate for a Vite plugin written as a TypeScript library.

## Install

```bash
npm install
```

## Development Scripts

```bash
npm run dev         # watch mode library build
npm run typecheck   # TypeScript validation
npm run format      # Prettier
npm run test        # Vitest
npm run build       # declaration files + Vite library build
```

## Usage

```ts
import { defineConfig } from 'vite';
import asyncInstrument from '@glmachado/async-instrument';

export default defineConfig({
  plugins: [
    asyncInstrument({
      include: /\\.[jt]s$/,
      transform(code, id) {
        if (id.includes('node_modules')) {
          return null;
        }

        return `${code}\n// transformed`;
      }
    })
  ]
});
```

## Publish

The `prepublishOnly` script runs type checks, tests, and build before publishing.
