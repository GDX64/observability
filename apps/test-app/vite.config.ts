import { defineConfig } from 'vite';
import asyncInstrument from '@glmachado/async-instrument';

export default defineConfig({
  plugins: [
    asyncInstrument({
      include: /\.ts$/,
      transform: (code) => `// instrumented\n${code}\n// instrumented`
    })
  ]
});
