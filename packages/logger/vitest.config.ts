import { defineConfig } from 'vitest/config';
import { asyncInstrumentPlugin } from '@glmachado/async-instrument';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  plugins: [
    asyncInstrumentPlugin({
      ignore: /node_modules|logger\.ts/
    })
  ]
});
