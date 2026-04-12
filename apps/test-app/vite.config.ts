import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import asyncInstrument from '@glmachado/async-instrument';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    asyncInstrument({
      include: /\.tsx?$/,
      transform: (code) => `console.log('async will run');\n${code}\nconsole.log('async did run');`
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
