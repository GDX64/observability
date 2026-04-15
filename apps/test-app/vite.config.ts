import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { asyncInstrumentPlugin } from '@glmachado/async-instrument';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    asyncInstrumentPlugin({
      contextName: 'context',
      getFunctionName: 'getAsyncContext'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
