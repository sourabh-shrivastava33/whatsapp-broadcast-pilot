/**
 * AppProviders — single wrapper composing all context providers.
 * Import this once in App.jsx. Order matters: theme first, workspace data last.
 */
import React from 'react'
import { ThemeProvider } from './ThemeContext'
import { AccountsProvider } from './AccountsContext'
import { ContactsProvider } from './ContactsContext'
import { TemplatesProvider } from './TemplatesContext'
import { BroadcastsProvider } from './BroadcastsContext'
import { MediaProvider } from './MediaContext'

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AccountsProvider>
        <ContactsProvider>
          <MediaProvider>
            <TemplatesProvider>
              <BroadcastsProvider>
                {children}
              </BroadcastsProvider>
            </TemplatesProvider>
          </MediaProvider>
        </ContactsProvider>
      </AccountsProvider>
    </ThemeProvider>
  )
}
