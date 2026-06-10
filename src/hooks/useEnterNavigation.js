import { useEffect } from 'react';
import { getFirstFocusable, getFocusableElements } from '../utils/focusManagement';

/**
 * useEnterNavigation
 * Adds global handling for the Enter key to move focus between form fields.
 * 
 * NEW BEHAVIOR:
 * - If nothing is focused: First Enter focuses the first focusable element
 * - If something is focused: Enter moves to the next focusable element
 * - Shift+Enter: moves focus to the previous focusable element
 * - Skips disabled, hidden, readonly elements
 * - Leaves normal behavior inside TEXTAREA
 * 
 * This hook does NOT auto-focus elements on page load.
 * Users must press Enter to start navigating through form fields.
 */
export default function useEnterNavigation() {
  useEffect(() => {
    const handler = (e) => {
      // Ignore if focus is on a textarea or contenteditable or modifiers pressed
      const active = document.activeElement;
      const tag = active?.tagName;
      
      // Allow Enter in textarea
      if (tag === 'TEXTAREA' || e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        
        const selector = 'input:not([disabled]):not([type=hidden]):not([readonly]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
        const focusable = getFocusableElements(selector);
        
        // Case 1: Nothing is focused - focus the first field
        if (document.activeElement === document.body || active === null || !focusable.includes(active)) {
          const first = getFirstFocusable(selector);
          if (first) {
            first.focus();
          }
          return;
        }
        
        // Case 2: Something is focused - move to next/previous
        const currentIndex = focusable.indexOf(active);
        
        if (e.shiftKey) {
          // Move backward
          const prev = focusable[currentIndex - 1] || focusable[focusable.length - 1];
          prev?.focus();
        } else {
          // Move forward
          const next = focusable[currentIndex + 1] || focusable[0];
          next?.focus();
        }
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
