/**
 * ThemeContext — dark / light theme state.
 * Writes data-theme attribute to <html> so CSS vars pick it up.
 * Persists to localStorage['wa_crm_theme'].
 */
import React, { createContext, useContext, useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('wa_crm_theme', 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
