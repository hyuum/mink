import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initStore } from './data/store';
import { updateReady } from './app/ui-state';

createRoot(document.getElementById('root')!).render(<App />);
void initStore();

// Offline support for the installed app. Skipped in the preview build, where service workers aren't allowed.
if (!__PREVIEW__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // When a newer version takes over while the app is open, offer to refresh into it.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) updateReady.set(true); });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Installed apps can stay open for days: check for a new version whenever the app comes back.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => undefined); });
    }).catch(() => undefined);
  });
}
