import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AppProviders } from './store/AppProviders'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import ErrorBoundary from './components/ErrorBoundary'
import './components/ui/ui.css'

// Lazy loaded routes for Lighthouse Performance (Code Splitting)
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Accounts = React.lazy(() => import('./pages/Accounts'))
const Contacts = React.lazy(() => import('./pages/Contacts'))
const Templates = React.lazy(() => import('./pages/Templates'))
const TemplateBuilder = React.lazy(() => import('./pages/TemplateBuilder'))
const Broadcast = React.lazy(() => import('./pages/Broadcast'))
const BroadcastDetail = React.lazy(() => import('./pages/BroadcastDetail'))
const Compliance = React.lazy(() => import('./pages/Compliance'))
const HealthDashboard = React.lazy(() => import('./pages/HealthDashboard'))
const Inbox = React.lazy(() => import('./pages/Inbox'))
const Webhooks = React.lazy(() => import('./pages/Webhooks'))
const MediaLibrary = React.lazy(() => import('./pages/MediaLibrary'))
const AccountHealth = React.lazy(() => import('./pages/AccountHealth'))

const FullPageLoader = () => (
  <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
    <Loader2 className="animate-spin text-accent" size={32} />
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppLayout>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/health" element={<AccountHealth />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/new" element={<TemplateBuilder />} />
          <Route path="/templates/:id/edit" element={<TemplateBuilder />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/broadcast/:id" element={<BroadcastDetail />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/health" element={<HealthDashboard />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </AppProviders>
    </ErrorBoundary>
  )
}
