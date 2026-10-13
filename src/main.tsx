import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initStore } from './data/store';

createRoot(document.getElementById('root')!).render(<App />);
void initStore();

// Offline support for the installed app. Skipped in the preview build, where service workers aren't allowed.
if (!__PREVIEW__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  });
}
