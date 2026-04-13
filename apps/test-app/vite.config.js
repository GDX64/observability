import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import asyncInstrument from '@glmachado/async-instrument';
import path from 'path';
export default defineConfig({
  plugins: [
    react(),
    asyncInstrument({
      include: /\.tsx?$/,
      transform: function (code) {
        return 'let __span__ = logger.popSpan();\n'.concat(code, '\nlogger.resume(__span__);');
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
