import React from 'react'
import { Sidebar } from './Sidebar'
import { CommandStrip } from './CommandStrip'
import './AppLayout.css'

export function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <CommandStrip />
      <Sidebar />
      <main className="app-content">
        {children}
      </main>
    </div>
  )
}
