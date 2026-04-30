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
import { ToastProvider } from './ToastContext'

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
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
      </ToastProvider>
    </ThemeProvider>
  )
}
