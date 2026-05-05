import config from '../config.js';
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Users, 
  Send, 
  CheckCheck, 
  Eye, 
  AlertCircle, 
  Smartphone, 
  FileText,
  Calendar,
  Clock,
  ExternalLink,
  Search,
  MessageSquare,
  BarChart3,
  Zap
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import './BroadcastDetail.css'
import { socket } from '../lib/socket'

export default function BroadcastDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!id || id === 'undefined') {
      setError('Invalid Broadcast ID')
      setLoading(false)
      return
    }
    fetch(`${config.API_URL}/broadcasts/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Broadcast not found')
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  // Real-time updates
  useEffect(() => {
    const handleStatusUpdate = (update) => {
      if (update.broadcastId === id) {
        setData(prev => {
          if (!prev) return prev;
          
          // Update the specific message in the list
          const updatedMessages = prev.messages.map(m => 
            m.metaMessageId === update.metaId || m.id === update.messageId
              ? { ...m, status: update.status }
              : m
          );

          // Recalculate stats based on updated messages (Cumulative Logic)
          const newStats = {
            total: updatedMessages.length,
            sent: updatedMessages.filter(m => !['queued', 'failed'].includes(m.status)).length,
            delivered: updatedMessages.filter(m => ['delivered', 'read'].includes(m.status)).length,
            read: updatedMessages.filter(m => m.status === 'read').length,
            failed: updatedMessages.filter(m => m.status === 'failed').length,
          };

          return {
            ...prev,
            messages: updatedMessages,
            stats: newStats
          };
        });
      }
    };

    socket.on('message_status_update', handleStatusUpdate);
    return () => socket.off('message_status_update', handleStatusUpdate);
  }, [id]);

  if (loading) {
    return (
      <div className="page fade-in">
        <div className="loading-container">
          <div className="wizard-spinner" />
          <p>Analyzing campaign performance...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page fade-in">
        <div className="error-container">
          <AlertCircle size={48} color="var(--status-rejected)" />
          <h2>Campaign Not Found</h2>
          <p>{error || 'The requested broadcast data could not be loaded.'}</p>
          <Link to="/broadcast">
            <Button variant="primary">Back to Broadcasts</Button>
          </Link>
        </div>
      </div>
    )
  }

  const { stats, messages, template, account } = data
  
  const filteredMessages = (messages || []).filter(m => 
    (m.contact?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.contact?.phone || '').includes(search)
  )

  const openRate = stats.sent > 0 ? Math.round((stats.read / stats.sent) * 100) : 0
  const deliveryRate = stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0

  return (
    <div className="page fade-in">
      <div className="broadcast-detail">
        {/* Navigation */}
        <div className="detail-nav">
          <Link to="/broadcast" className="back-link">
            <ArrowLeft size={16} />
            Back to Broadcasts
          </Link>
        </div>

        {/* Error Banner */}
        {(stats.failed > 0 || data.status === 'failed' || data.status === 'completed_with_errors') && (
          <div className="error-banner fade-in">
            <div className="error-banner-icon">
              <AlertCircle size={20} />
            </div>
            <div className="error-banner-content">
              <h3>Campaign Issue Detected</h3>
              <p>
                {messages.find(m => m.error)?.error || 
                 data.results?.error || 
                 'One or more messages failed to send due to a technical issue with the Meta API.'}
              </p>
            </div>
            {messages.find(m => m.error?.includes('131005')) && (
              <div className="error-banner-action">
                <a 
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-error-link"
                >
                  View Meta Error Docs <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Header Card */}
        <div className="detail-header-card">
          <div className="detail-meta">
            <div className="detail-title-row">
              <h1>Broadcast Performance</h1>
              <span className="detail-id">#{id.split('-')[0].toUpperCase()}</span>
            </div>
            <p className="detail-subtitle">
              Sent via <strong>{account?.displayName || 'Unknown Account'}</strong> · {data.sentAt ? new Date(data.sentAt).toLocaleString() : 'Date unknown'}
            </p>
          </div>
          <div className={`chip chip-${data.status || 'unknown'}`}>
            <span className="chip-dot" />
            {(data.status || 'unknown').charAt(0).toUpperCase() + (data.status || 'unknown').slice(1)}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="detail-stats-grid">
          <div className="stat-card">
            <div className="stat-label"><Users size={14} /> Total Recipients</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-percent neutral">Campaign Target</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><Send size={14} /> Messages Sent</div>
            <div className="stat-value">{stats.sent}</div>
            <div className="stat-percent positive">{stats.total > 0 ? Math.round((stats.sent/stats.total)*100) : 0}% Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><CheckCheck size={14} /> Delivered</div>
            <div className="stat-value">{stats.delivered}</div>
            <div className="stat-percent neutral">{data.metrics?.deliveryRate || 0}% Delivery</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><Eye size={14} /> Total Reads</div>
            <div className="stat-value">{stats.read}</div>
            <div className="stat-percent positive">{data.metrics?.readRate || 0}% Read Rate</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '2px solid var(--accent)' }}>
            <div className="stat-label"><Zap size={14} color="var(--accent)" /> Est. Cost</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>${data.metrics?.estimatedCost || '0.00'}</div>
            <div className="stat-percent neutral">Meta Business API</div>
          </div>
        </div>

        <div className="detail-main-grid">
          {/* Left Column: Progress & Recipients */}
          <div className="detail-column">
            <div className="delivery-overview">
              <h2 className="section-title"><BarChart3 size={20} color="var(--accent)" /> Campaign Analytics</h2>
              <div className="analytics-summary-cards">
                <div className="analytics-card">
                  <span className="analytics-label">Delivery Rate</span>
                  <span className="analytics-value">{data.metrics?.deliveryRate}%</span>
                </div>
                <div className="analytics-card">
                  <span className="analytics-label">Open Rate</span>
                  <span className="analytics-value">{data.metrics?.readRate}%</span>
                </div>
                <div className="analytics-card">
                  <span className="analytics-label">Failure Rate</span>
                  <span className="analytics-value">{data.metrics?.failureRate}%</span>
                </div>
              </div>
              
              <div className="progress-group" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="progress-item">
                  <div className="progress-label-row">
                    <span>Sent</span>
                    <span>{stats.sent} / {stats.total}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${stats.total > 0 ? (stats.sent/stats.total)*100 : 0}%`, background: 'var(--status-sent)' }} />
                  </div>
                </div>
                <div className="progress-item">
                  <div className="progress-label-row">
                    <span>Delivered</span>
                    <span>{stats.delivered} / {stats.sent}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${data.metrics?.deliveryRate}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
                <div className="progress-item">
                  <div className="progress-label-row">
                    <span>Read</span>
                    <span>{stats.read} / {stats.delivered}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${data.metrics?.readRate}%`, background: '#2ecc71' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="recipients-section" style={{ marginTop: 'var(--space-xl)' }}>
              <div className="section-title" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <Users size={20} color="var(--accent)" /> Recipients List
                </div>
                <div className="search-bar mini">
                  <Search size={14} />
                  <input 
                    type="text" 
                    placeholder="Filter list..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="recipients-list">
                <div className="recipient-row header">
                  <span>Contact</span>
                  <span>Status</span>
                  <span>Time</span>
                  <span>Meta ID</span>
                </div>
                {filteredMessages.length === 0 ? (
                  <div className="recipient-row" style={{ gridTemplateColumns: '1fr', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No recipients found matching your search.
                  </div>
                ) : (
                  filteredMessages.map(m => (
                    <div 
                      key={m.id} 
                      className="recipient-row clickable"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/inbox?contactId=${m.contact.id}`)}
                    >
                      <div className="recipient-info">
                        <span className="recipient-name">{m.contact.name}</span>
                        <span className="recipient-phone">{m.contact.phone}</span>
                      </div>
                      <div className="row-status">
                        <span className={`status-chip ${m.status}`}>
                          {m.status === 'sent' && <Send size={10} />}
                          {m.status === 'delivered' && <CheckCheck size={10} />}
                          {m.status === 'read' && <Eye size={10} />}
                          {m.status === 'failed' && <AlertCircle size={10} />}
                          {m.status}
                        </span>
                      </div>
                      <div className="row-time">
                        {m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                      <div className="row-time" style={{ fontFamily: 'monospace', opacity: 0.5 }}>
                        {m.metaMessageId ? m.metaMessageId.slice(-12) : '-'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Template & Account Details */}
          <div className="detail-column">
            <div className="template-preview-card">
              <h2 className="section-title"><FileText size={20} color="var(--accent)" /> Template Content</h2>
              <div className="preview-bubble">
                {template.header && <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{template.header}</div>}
                {template.body}
                <div className="preview-footer">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="template-info-list" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="summary-row">
                  <span>Name</span>
                  <strong>{template.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Category</span>
                  <strong>{template.category}</strong>
                </div>
                <div className="summary-row">
                  <span>Language</span>
                  <strong>{template.language}</strong>
                </div>
              </div>
            </div>

            <div className="template-preview-card" style={{ marginTop: 'var(--space-xl)' }}>
              <h2 className="section-title"><Smartphone size={20} color="var(--accent)" /> Sending Account</h2>
              <div className="summary-row">
                <span>Account</span>
                <strong>{account.displayName}</strong>
              </div>
              <div className="summary-row">
                <span>WABA ID</span>
                <strong style={{ fontSize: '11px', opacity: 0.7 }}>{account.wabaId}</strong>
              </div>
              <div className="summary-row">
                <span>Quality</span>
                <strong style={{ color: 'var(--accent)' }}>{account.qualityRating || 'Green'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
