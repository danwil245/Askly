import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { applyTheme, resolveTheme } from './lib/theme.js';

// Apply the stored/system theme before first paint to avoid a flash.
applyTheme(resolveTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
