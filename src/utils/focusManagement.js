/**
 * Focus Management Utilities
 * Reusable functions for keyboard navigation
 */

/**
 * Get all focusable elements that match the selector and are visible
 * @param {string} selector - CSS selector for focusable elements
 * @returns {Element[]} Array of focusable elements
 */
export const getFocusableElements = (selector = 'input:not([disabled]):not([type=hidden]):not([readonly]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])') => {
  return Array.from(document.querySelectorAll(selector)).filter((el) => {
    // Check if element is visible (offsetParent !== null)
    return el.offsetParent !== null
  })
}

/**
 * Get the first focusable element in the document
 * @param {string} selector - CSS selector for focusable elements (optional)
 * @returns {Element|null} First focusable element or null
 */
export const getFirstFocusable = (selector) => {
  const focusable = getFocusableElements(selector)
  if (focusable.length === 0) return null

  const preferred = focusable.find((el) => {
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  })

  return preferred || focusable[0]
}

/**
 * Get the next focusable element from current position
 * @param {Element} currentElement - Current element
 * @param {string} selector - CSS selector (optional)
 * @returns {Element|null} Next focusable element
 */
export const getNextFocusable = (currentElement, selector) => {
  const focusable = getFocusableElements(selector)
  const currentIndex = focusable.indexOf(currentElement)
  if (currentIndex === -1) return focusable[0] || null
  return focusable[currentIndex + 1] || focusable[0] || null
}

/**
 * Get the previous focusable element from current position
 * @param {Element} currentElement - Current element
 * @param {string} selector - CSS selector (optional)
 * @returns {Element|null} Previous focusable element
 */
export const getPreviousFocusable = (currentElement, selector) => {
  const focusable = getFocusableElements(selector)
  const currentIndex = focusable.indexOf(currentElement)
  if (currentIndex === -1) return focusable[focusable.length - 1] || null
  return focusable[currentIndex - 1] || focusable[focusable.length - 1] || null
}

/**
 * Move focus to next focusable element
 * @param {Element} currentElement - Current element
 * @param {string} selector - CSS selector (optional)
 * @returns {Element|null} The element that received focus
 */
export const moveToNextField = (currentElement, selector) => {
  const next = getNextFocusable(currentElement, selector)
  if (next) {
    next.focus()
  }
  return next
}

/**
 * Move focus to previous focusable element
 * @param {Element} currentElement - Current element
 * @param {string} selector - CSS selector (optional)
 * @returns {Element|null} The element that received focus
 */
export const moveToPreviousField = (currentElement, selector) => {
  const prev = getPreviousFocusable(currentElement, selector)
  if (prev) {
    prev.focus()
  }
  return prev
}

/**
 * Blur the currently active element
 * @returns {void}
 */
export const blurActiveElement = () => {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur()
  }
}

/**
 * Get visible dropdowns in the page
 * @returns {Element[]} Array of visible dropdown elements
 */
export const getVisibleDropdowns = () => {
  return Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [data-dropdown="true"]')).filter(
    (el) => el.offsetParent !== null && getComputedStyle(el).display !== 'none'
  )
}

/**
 * Check if a dropdown/list is open and visible
 * @returns {boolean} True if any dropdown is open
 */
export const isDropdownOpen = () => {
  return getVisibleDropdowns().length > 0
}

/**
 * Close all visible dropdowns
 * @returns {void}
 */
export const closeAllDropdowns = () => {
  getVisibleDropdowns().forEach((dropdown) => {
    if (dropdown.dataset.close) {
      // Custom close handler if set
      dropdown.dataset.close()
    } else {
      // Try to hide element
      dropdown.style.display = 'none'
      dropdown.removeAttribute('aria-expanded')
    }
  })
}
