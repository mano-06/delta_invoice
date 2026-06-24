import { useEffect } from 'react'
import { getPreviousFocusable } from '../utils/focusManagement'

const DEFAULT_SELECTOR = 'input:not([disabled]):not([type=hidden]):not([readonly]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'

export default function useBackspaceNavigation({ isDropdownOpen = false } = {}) {
  useEffect(() => {
    const handler = (event) => {
      if (event.key !== 'Backspace' || event.ctrlKey || event.altKey || event.metaKey) return

      const active = document.activeElement
      if (!active || active === document.body || active === document.documentElement) return

      const tag = active.tagName
      if (tag === 'TEXTAREA' || active.isContentEditable) return
      if (active.readOnly || active.disabled) return
      if (active.offsetParent === null) return
      if (!['INPUT', 'SELECT'].includes(tag)) return

      if (tag === 'INPUT') {
        const skipInputTypes = ['button', 'submit', 'reset', 'image', 'file', 'checkbox', 'radio']
        if (skipInputTypes.includes(active.type)) return
      }

      const value = active.value ?? ''
      if (String(value).length > 0) return
      if (isDropdownOpen) return

      const previous = getPreviousFocusable(active, DEFAULT_SELECTOR)
      if (!previous) return

      event.preventDefault()
      previous.focus()

      if (typeof previous.value === 'string' && previous.setSelectionRange) {
        const end = previous.value.length
        previous.setSelectionRange(end, end)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDropdownOpen])
}
