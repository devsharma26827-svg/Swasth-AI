import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Handle any benign MediaStreamTrack asynchronous teardown rejections from browser media subsystem
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    (typeof event.reason.message === 'string' &&
      (event.reason.message.includes('The associated Track is in an invalid state') ||
       event.reason.message.includes('Track is in an invalid state')) ||
     event.reason.name === 'InvalidStateError')
  ) {
    console.warn('Benign MediaStreamTrack invalid state rejection safely handled:', event.reason);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
