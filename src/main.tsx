import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initStore } from './data/store';

// The app runs only inside the Android app, which ships its files with it: no service worker or web install.
createRoot(document.getElementById('root')!).render(<App />);
void initStore();
