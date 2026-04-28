import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone,
  Users,
  FileText,
  Radio,
  UserPlus,
  FilePlus,
  Activity,
  Zap
} from 'lucide-react'
import { useAccounts } from '../store/AccountsContext'
import { useContacts } from '../store/ContactsContext'
import { useTemplates } from '../store/TemplatesContext'
import { useBroadcasts } from '../store/BroadcastsContext'
import './Dashboard.css'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { accounts } = useAccounts()
  const { contacts } = useContacts()
  const { templates } = useTemplates()
  const { broadcasts } = useBroadcasts()

  const stats = [
    { label: 'Connected Accounts', value: accounts.length, icon: Smartphone, color: 'green', path: '/accounts' },
    { label: 'Total Contacts', value: contacts.length, icon: Users, color: 'blue', path: '/contacts' },
    { label: 'Templates', value: templates.length, icon: FileText, color: 'amber', path: '/templates' },
    { label: 'Broadcasts Sent', value: broadcasts.length, icon: Radio, color: 'purple', path: '/broadcast' },
  ]

  const quickActions = [
    {
      icon: Smartphone,
      title: 'Connect Account',
      description: 'Link a WhatsApp Business account',
      onClick: () => navigate('/accounts'),
    },
    {
      icon: UserPlus,
      title: 'Add Contacts',
      description: 'Import or add recipients',
      onClick: () => navigate('/contacts'),
    },
    {
      icon: FilePlus,
      title: 'Create Template',
      description: 'Design a message template',
      onClick: () => navigate('/templates'),
    },
  ]

  // Approved templates count for dashboard insight
  const approvedCount = templates.filter((t) => t.status === 'approved').length

  return (
    <div className="page fade-in">
      {/* Greeting */}
      <div className="dashboard-greeting">
        <h1>
          {getGreeting()}, <span className="accent">Demo User</span>
        </h1>
        <p>Here's an overview of your WhatsApp broadcast workspace.</p>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        {stats.map((stat, idx) => (
          <div
            key={stat.label}
            className="stat-card"
            style={{ animationDelay: `${idx * 80}ms` }}
            onClick={() => navigate(stat.path)}
          >
            <div className={`stat-card-icon ${stat.color}`}>
              <stat.icon size={22} />
            </div>
            <div className="stat-card-info">
              <div className="stat-card-value">{stat.value}</div>
              <div className="stat-card-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="dashboard-section-title">Quick Actions</h2>
      <div className="quick-actions">
        {quickActions.map((action) => (
          <div
            key={action.title}
            className="quick-action-card"
            onClick={action.onClick}
          >
            <div className="quick-action-icon">
              <action.icon size={20} />
            </div>
            <div className="quick-action-text">
              <h3>{action.title}</h3>
              <p>{action.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <h2 className="dashboard-section-title">Recent Activity</h2>
      {broadcasts.length === 0 && contacts.length === 0 ? (
        <div className="activity-empty">
          <Activity size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No activity yet. Start by connecting a WhatsApp account.</p>
        </div>
      ) : (
        <div className="activity-feed">
          {approvedCount > 0 && (
            <div className="activity-item">
              <Zap size={14} className="activity-icon success" />
              <span><strong>{approvedCount}</strong> template{approvedCount > 1 ? 's' : ''} approved and ready to broadcast</span>
            </div>
          )}
          {contacts.length > 0 && (
            <div className="activity-item">
              <Users size={14} className="activity-icon info" />
              <span><strong>{contacts.length}</strong> contact{contacts.length > 1 ? 's' : ''} in your list</span>
            </div>
          )}
          {broadcasts.length > 0 && (
            <div className="activity-item">
              <Radio size={14} className="activity-icon" />
              <span><strong>{broadcasts.length}</strong> broadcast{broadcasts.length > 1 ? 's' : ''} sent</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

