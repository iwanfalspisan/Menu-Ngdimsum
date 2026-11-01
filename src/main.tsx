import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as unknown as { __deferredPwaPrompt?: Event }).__deferredPwaPrompt = e;
  });
}

createRoot(document.getElementById('root')!).render(<App />);

