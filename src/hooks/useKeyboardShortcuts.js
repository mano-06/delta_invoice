import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { blurActiveElement, closeAllDropdowns } from '../utils/focusManagement';

/**
 * useKeyboardShortcuts
 * Centralized handling of global page shortcuts.
 *   D – Dashboard
 *   C – Create Invoice
 *   I – Invoice History
 *   U – Customers
 *   P – Products
 *   S – Settings
 *   B – Backup & Restore
 *   Esc – Blur focused element, or trigger app exit if nothing focused
 *
 * Shortcuts are ignored when focus is on input/textarea/contenteditable
 * or when any modifier key (Ctrl, Alt, Meta) is pressed.
 *
 * Esc behavior:
 * - If any element is focused: blur it and close any open dropdowns
 * - If nothing is focused: trigger app exit
 *
 * @param {Object} options optional callbacks for modal or dropdown state
 */
export default function useKeyboardShortcuts({ isModalOpen = false, isDropdownOpen = false, onAppExit } = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      // Handle Esc key first (works even if editing)
      if (e.key === 'Escape') {
        const active = document.activeElement;
        const isEditing = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable;
        
        if (isEditing || active?.tagName === 'SELECT' || active?.tagName === 'BUTTON') {
          // Close any dropdowns first
          closeAllDropdowns();
          // Then blur the active element
          blurActiveElement();
          e.preventDefault();
          return;
        }
        
        // If nothing is focused, trigger app exit
        if (document.activeElement === document.body || active === null) {
          if (onAppExit) {
            onAppExit();
          }
          e.preventDefault();
          return;
        }
      }

      // Ignore if focus is on an editable element or modifiers are pressed
      const tag = document.activeElement?.tagName;
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if (isEditable || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Disable shortcuts when a modal or a dropdown is open
      if (isModalOpen || isDropdownOpen) return;

      const key = e.key.toUpperCase();
      switch (key) {
        case 'D':
          navigate('/dashboard');
          break;
        case 'C':
          navigate('/create-invoice');
          break;
        case 'I':
          navigate('/invoice-history');
          break;
        case 'U':
          navigate('/customers');
          break;
        case 'P':
          navigate('/products');
          break;
        case 'S':
          navigate('/settings');
          break;
        case 'B':
          navigate('/backup');
          break;
        default:
          return; // not a shortcut we care about
      }
      e.preventDefault(); // prevent any default browser action
    };

    window.addEventListener('keydown', handler);
    // Cleanup to avoid stacking listeners
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [navigate, isModalOpen, isDropdownOpen, onAppExit]);
}
