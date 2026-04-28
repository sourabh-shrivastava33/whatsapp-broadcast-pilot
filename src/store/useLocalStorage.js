/**
 * useLocalStorage — Custom hook for persisting state to localStorage.
 * Reads initial value from storage, falls back to initialValue.
 * Returns [state, setState] just like useState.
 */
import { useState, useEffect } from 'react'

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to read "${key}":`, err)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to write "${key}":`, err)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue]
}
