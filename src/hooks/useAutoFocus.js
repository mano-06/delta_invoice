import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * useAutoFocus
 * UPDATED BEHAVIOR: No longer auto-focuses elements on route change.
 * 
 * Users must press Enter to start form navigation.
 * 
 * If you need to focus a specific element on mount, use targetRef:
 * useAutoFocus(ref) - will focus the provided ref
 * 
 * @param {Object} targetRef - Optional ref to a specific element to focus
 */
export default function useAutoFocus(targetRef) {
  const location = useLocation();

  useEffect(() => {
    // Only focus if targetRef is explicitly provided
    if (targetRef && targetRef.current) {
      // Delay to allow the new page to render
      const timer = setTimeout(() => {
        targetRef.current.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
    // Otherwise, don't auto-focus anything
  }, [location, targetRef]);
}
