import React, { useState, useEffect, useMemo } from 'react'
import { Activity, ShieldAlert, ShieldCheck, Info, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react'
import { useAccounts } from '../store/AccountsContext'
import { io } from 'socket.io-client'
import './HealthDashboard.css'

export default function HealthDashboard() {
  const { accounts, refreshAccounts } = useAccounts()
  const [realtimeEvents, setRealtimeEvents] = useState([])
  
  // Setup Socket.io connection for live health updates
  useEffect(() => {
    const socket = io('http://localhost:3001')
    
    socket.on('account_health_updated', (data) => {
      // data: { accountId, qualityRating, event }
      setRealtimeEvents(prev => [{
        id: Date.now(),
        time: new Date(),
        message: `Account ${data.accountId.substring(0, 8)}... quality changed to ${data.qualityRating}.`,
        type: data.qualityRating === 'RED' ? 'error' : data.qualityRating === 'YELLOW' ? 'warning' : 'success'
      }, ...prev].slice(0, 10))
      
      // Refresh the accounts list in context to update the UI
      refreshAccounts()
    })

    return () => socket.disconnect()
  }, [refreshAccounts])

  const getQualityTheme = (quality) => {
    switch (quality?.toUpperCase()) {
      case 'GREEN': return { color: 'var(--status-approved)', icon: <ShieldCheck size={24} />, label: 'High Quality', desc: 'Account is healthy. Broadcast limits will increase automatically if you maintain this.', barClass: 'bg-success' }
      case 'YELLOW': return { color: '#f59e0b', icon: <AlertTriangle size={24} />, label: 'Medium Quality', desc: 'Warning: High block rate detected. Review template quality.', barClass: 'bg-warning' }
      case 'RED': return { color: 'var(--status-rejected)', icon: <ShieldAlert size={24} />, label: 'Low Quality', desc: 'Critical: Account flagged. Limits will be downgraded. Pause broadcasts immediately.', barClass: 'bg-danger' }
      default: return { color: 'var(--text-secondary)', icon: <Activity size={24} />, label: 'Unknown', desc: 'Quality rating not yet synchronized with Meta.', barClass: 'bg-muted' }
    }
  }

  const activeAccounts = useMemo(() => accounts.filter(a => a.isActive), [accounts])

  return (
    <div className="page fade-in health-dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Account Health Dashboard</h1>
          <p className="page-subtitle">Real-time monitoring of Meta Quality Ratings and Messaging Limits.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={refreshAccounts}>
            <RefreshCw size={16} /> Sync Now
          </button>
        </div>
      </div>

      <div className="health-grid">
        <div className="health-main">
          {activeAccounts.length === 0 ? (
            <div className="empty-state">No active accounts found. Please connect an account.</div>
          ) : (
            activeAccounts.map(account => {
              const theme = getQualityTheme(account.qualityRating)
              return (
                <div className={`health-card ${account.qualityRating?.toLowerCase() === 'red' ? 'card-danger' : ''}`} key={account.id}>
                  <div className="health-card-header">
                    <div>
                      <h3 className="health-account-name">{account.displayName}</h3>
                      <p className="health-account-phone">+{account.displayPhoneNumber || account.phoneNumberId}</p>
                    </div>
                    <div className="health-badge" style={{ color: theme.color, backgroundColor: `${theme.color}15` }}>
                      {theme.icon}
                      <span>{theme.label}</span>
                    </div>
                  </div>
                  
                  <div className="health-metric-row">
                    <div className="health-metric">
                      <span className="metric-label">Current Messaging Limit</span>
                      <span className="metric-value">{account.tierLimit === Infinity ? 'Unlimited' : (account.tierLimit || 'Unknown').toLocaleString()}</span>
                    </div>
                    <div className="health-metric">
                      <span className="metric-label">Quality Score</span>
                      <span className="metric-value" style={{ color: theme.color }}>{account.qualityRating || 'UNKNOWN'}</span>
                    </div>
                  </div>

                  <div className="health-progress-container">
                    <div className="health-progress-bar">
                      <div className={`health-progress-fill ${theme.barClass}`} style={{ width: account.qualityRating === 'GREEN' ? '100%' : account.qualityRating === 'YELLOW' ? '60%' : account.qualityRating === 'RED' ? '20%' : '0%' }}></div>
                    </div>
                    <p className="health-progress-desc">{theme.desc}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="health-sidebar">
          <div className="health-log-card">
            <h3 className="health-log-title">Live Webhook Events</h3>
            <div className="health-log-list">
              {realtimeEvents.length === 0 ? (
                <div className="health-log-empty">Waiting for Meta events...</div>
              ) : (
                realtimeEvents.map(evt => (
                  <div key={evt.id} className={`health-log-item log-${evt.type}`}>
                    <span className="log-time">{evt.time.toLocaleTimeString()}</span>
                    <span className="log-msg">{evt.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="health-info-card">
            <Info size={20} className="health-info-icon" />
            <h4>How Quality works</h4>
            <p>Meta tracks the block rate of your messages. If users block or report your templates, your Quality Rating drops from Green to Yellow, and then Red.</p>
            <p>If your account reaches Red, your tier limit is downgraded instantly.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
