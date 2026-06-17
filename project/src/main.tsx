import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './LanguageContext.tsx';

/**
 * SPA entry: Vercel rewrites all paths to index.html. Canonical URL is "/" while
 * preserving hash deep-links (e.g. #settings-exchange) used by Profile/Settings.
 */
function normalizeSpaEntryPath(): void {
  const { pathname, search, hash } = window.location;
  if (pathname !== '/' && pathname !== '') {
    window.history.replaceState(null, '', `/${search}${hash}`);
  }
}

normalizeSpaEntryPath();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);
