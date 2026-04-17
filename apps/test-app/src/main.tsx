import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { logger } from '../../../packages/logger/dist/logger';

(window as any).logger = logger;

logger.subscribe((log) => {
  console.log('log received in app', log);
});

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
