import { useEffect, useRef, useState } from 'react';
import { safeListen } from '../utils/tauriEvents';

const IDLE_TIMEOUT_MS = 15000; // 15 seconds

export function useIdleState() {
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Manage the CSS class on document.body
    if (isIdle) {
      document.body.classList.add('app-is-idle');
    } else {
      document.body.classList.remove('app-is-idle');
    }
  }, [isIdle]);

  useEffect(() => {
    const markActive = () => {
      if (isIdleRef.current) {
        setIsIdle(false);
        isIdleRef.current = false;
      }
      resetIdleTimeout();
    };

    const markIdle = () => {
      if (!isIdleRef.current) {
        setIsIdle(true);
        isIdleRef.current = true;
      }
    };

    const resetIdleTimeout = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(markIdle, IDLE_TIMEOUT_MS);
    };

    // 2. Tauri Window Focus/Blur Listeners
    const unlistenFocus = safeListen('tauri://focus', () => {
      markActive();
    });
    const unlistenBlur = safeListen('tauri://blur', () => {
      markIdle();
    });

    // 3. User Interaction Listeners
    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach(event => {
      document.addEventListener(event, markActive, { passive: true });
    });

    // Initial timeout start
    resetIdleTimeout();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, markActive);
      });
      unlistenFocus();
      unlistenBlur();
    };
  }, []);

  return isIdle;
}
