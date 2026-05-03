import React, { useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import Users from 'lucide-react/dist/esm/icons/users'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Radio from 'lucide-react/dist/esm/icons/radio'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import FilePlus from 'lucide-react/dist/esm/icons/file-plus'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Zap from 'lucide-react/dist/esm/icons/zap'

import { useAccounts } from '../store/AccountsContext'
import { useContacts } from '../store/ContactsContext'
import { useTemplates } from '../store/TemplatesContext'
import { useBroadcasts } from '../store/BroadcastsContext'

import { StatCard } from './dashboard/StatCard'
import { QuickActionCard } from './dashboard/QuickActionCard'
import { DashboardSkeleton } from './dashboard/DashboardSkeleton'
import './Dashboard.css'

const ActivityChart = React.lazy(() => import('./dashboard/ActivityChart'))

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const ActivityItem = memo(({ icon: Icon, title, message, variant }) => (
  <div className="activity-item">
    <Icon size={14} className={`activity-icon ${variant || ''}`} aria-hidden="true" />
    <span><strong>{title}</strong> {message}</span>
  </div>
))

export default function Dashboard() {
  const navigate = useNavigate()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { contacts, loading: contactsLoading } = useContacts()
  const { templates, loading: templatesLoading } = useTemplates()
  const { broadcasts, loading: broadcastsLoading } = useBroadcasts()

  const isPageLoading = accountsLoading || contactsLoading || templatesLoading || broadcastsLoading

  const greeting = useMemo(() => getGreeting(), [])

  const stats = useMemo(() => [
    { label: 'Connected Accounts', value: accounts.length, icon: Smartphone, color: 'green', path: '/accounts' },
    { label: 'Total Contacts', value: contacts.length, icon: Users, color: 'blue', path: '/contacts' },
    { label: 'Templates', value: templates.length, icon: FileText, color: 'amber', path: '/templates' },
    { label: 'Broadcasts Sent', value: broadcasts.length, icon: Radio, color: 'purple', path: '/broadcast' },
  ], [accounts.length, contacts.length, templates.length, broadcasts.length])

  const quickActions = useMemo(() => [
    {
      icon: Smartphone,
      title: 'Connect Account',
      description: 'Link a WhatsApp Business account',
      path: '/accounts',
    },
    {
      icon: UserPlus,
      title: 'Add Contacts',
      description: 'Import or add recipients',
      path: '/contacts',
    },
    {
      icon: FilePlus,
      title: 'Create Template',
      description: 'Design a message template',
      path: '/templates',
    },
  ], [])

  const approvedCount = useMemo(() => 
    templates.filter((t) => t.status === 'approved').length, 
  [templates])

  if (isPageLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="page fade-in dashboard-page">
      {/* Greeting Area */}
      <div className="dashboard-greeting">
        <h1>
          {greeting}, <span className="accent">Workspace Admin</span>
        </h1>
        <p>Here's an overview of your WhatsApp broadcast workspace.</p>
      </div>

      {/* Primary Stats Grid */}
      <div className="dashboard-stats">
        {stats.map((stat, idx) => (
          <StatCard 
            key={stat.label} 
            stat={stat} 
            idx={idx} 
            onClick={() => navigate(stat.path)} 
          />
        ))}
      </div>

      {/* Broadcast Performance Chart */}
      <h2 className="dashboard-section-title">Broadcast Performance</h2>
      <React.Suspense fallback={<div className="skeleton-pulse" style={{ height: '300px', width: '100%', borderRadius: '16px', marginBottom: 'var(--space-3xl)', background: 'var(--bg-card-muted)' }} />}>
        <ActivityChart />
      </React.Suspense>

      {/* Quick Actions Section */}
      <h2 className="dashboard-section-title">Quick Actions</h2>
      <div className="quick-actions">
        {quickActions.map((action) => (
          <QuickActionCard 
            key={action.title} 
            action={action} 
            onClick={() => navigate(action.path)} 
          />
        ))}
      </div>

      {/* Recent Activity Feed */}
      <h2 className="dashboard-section-title">Recent Activity</h2>
      
      {broadcasts.length === 0 && contacts.length === 0 ? (
        <div className="activity-empty">
          <Activity size={20} style={{ marginBottom: 8, opacity: 0.5 }} aria-hidden="true" />
          <p>No activity yet. Start by connecting a WhatsApp account.</p>
        </div>
      ) : (
        <div className="activity-feed">
          {approvedCount > 0 && (
            <ActivityItem 
              icon={Zap} 
              variant="success" 
              title={approvedCount} 
              message={`template${approvedCount > 1 ? 's' : ''} approved and ready to broadcast`} 
            />
          )}
          {contacts.length > 0 && (
            <ActivityItem 
              icon={Users} 
              variant="info" 
              title={contacts.length} 
              message={`contact${contacts.length > 1 ? 's' : ''} in your list`} 
            />
          )}
          {broadcasts.length > 0 && (
            <ActivityItem 
              icon={Radio} 
              title={broadcasts.length} 
              message={`broadcast${broadcasts.length > 1 ? 's' : ''} sent`} 
            />
          )}
        </div>
      )}
    </div>
  )
}
