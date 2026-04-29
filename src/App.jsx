import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AppProviders } from './store/AppProviders'
import './components/ui/ui.css'

import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Contacts from './pages/Contacts'
import Templates from './pages/Templates'
import TemplateBuilder from './pages/TemplateBuilder'
import Broadcast from './pages/Broadcast'
import BroadcastDetail from './pages/BroadcastDetail'
import Inbox from './pages/Inbox'
import Webhooks from './pages/Webhooks'
import MediaLibrary from './pages/MediaLibrary'

export default function App() {
  return (
    <AppProviders>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/new" element={<TemplateBuilder />} />
          <Route path="/templates/:id/edit" element={<TemplateBuilder />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/broadcast/:id" element={<BroadcastDetail />} />
        </Routes>
      </AppLayout>
    </AppProviders>
  )
}

