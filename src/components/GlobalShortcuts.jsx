import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import useAutoFocus from '../hooks/useAutoFocus';
import { useEffect } from 'react';

/**
 * GlobalShortcuts component
 * Renders inside the Router so that router hooks (useNavigate, useLocation) work.
 * It initialises both the global keyboard shortcuts and the auto‑focus behaviour.
 */
export default function GlobalShortcuts() {
  const handleAppExit = () => {
    // Send IPC message to electron to exit the app
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('exit-app');
    }
  };

  useKeyboardShortcuts({ onAppExit: handleAppExit });
  useAutoFocus();
  
  return null;
}
