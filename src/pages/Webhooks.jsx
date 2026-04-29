import React, { useState, useEffect } from 'react'
import { 
  Globe, 
  ShieldCheck, 
  RefreshCcw, 
  Activity, 
  AlertCircle, 
  ExternalLink,
  CheckCircle2,
  Copy,
  Zap,
  Info,
  Server
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import './Webhooks.css'

export default function Webhooks() {
  const [settings, setSettings] = useState({
    url: '',
    verifyToken: '',
    subscriptions: 'messages,statuses',
    isActive: true,
    healthStatus: 'unknown'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/webhook-settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data)
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('http://localhost:3001/api/webhook-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      setSettings(data)
      alert('Settings saved successfully!')
    } catch (err) {
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('http://localhost:3001/api/webhook-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: settings.url, verifyToken: settings.verifyToken })
      })
      const data = await res.json()
      setTestResult(data)
      if (data.success) {
        setSettings(prev => ({ ...prev, healthStatus: 'healthy' }))
      } else {
        setSettings(prev => ({ ...prev, healthStatus: 'failing' }))
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // Show toast or temporary icon change if desired
  }

  if (loading) return (
    <div className="page fade-in">
      <div className="wizard-spinner" style={{ margin: '100px auto' }} />
    </div>
  )

  const subs = settings.subscriptions.split(',')

  return (
    <div className="page fade-in">
      <div className="webhooks-page">
        <div className="page-header">
          <h1 className="page-title">Webhook Management</h1>
          <p className="page-subtitle">Configure how Meta Cloud API communicates with your CRM</p>
        </div>

        <div className="info-hint mb-6">
          <Server size={14} />
          <p>Webhooks allow Meta to push real-time updates (like message delivery status and incoming replies) directly to your server. Ensure your ngrok tunnel is active for local testing.</p>
        </div>

        {/* Status Hero */}
        <div className="status-hero">
          <div className="status-content">
            <div className="pulse-indicator">
              <div className={`pulse-dot ${settings.healthStatus === 'healthy' ? 'active' : settings.healthStatus === 'failing' ? 'error' : 'unknown'}`} />
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold' }}>
                Connection Status: {settings.healthStatus.toUpperCase()}
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {settings.healthStatus === 'healthy' 
                ? 'Your server is correctly receiving and validating Meta challenges.' 
                : settings.healthStatus === 'failing'
                ? 'The last connection attempt failed. Check your URL and token.'
                : 'Last sync: ' + (settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString() : 'Never')}
            </p>
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Button 
              variant="outline" 
              icon={RefreshCcw} 
              onClick={handleTest} 
              disabled={testing}
            >
              {testing ? 'Verifying...' : 'Test Connection'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
            {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {settings.metaError && (
          <div className="alert alert-error" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-rejected)' }}>
            <AlertCircle size={18} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong>Meta Automation Error</strong>
              <span style={{ fontSize: '12px' }}>{settings.metaError}</span>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="config-card">
          <div className="config-card-header">
            <Globe size={18} color="var(--accent)" />
            <h3 className="config-card-title">Webhook Endpoints</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Callback URL</label>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <input 
                  className="form-input" 
                  style={{ flex: 1 }}
                  placeholder="https://your-ngrok-url.app/api/webhooks"
                  value={settings.url}
                  onChange={e => setSettings({ ...settings, url: e.target.value })}
                />
                <button className="copy-btn" onClick={() => copyToClipboard(settings.url)}><Copy size={16} /></button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expose your local port 3001 using ngrok.</span>
            </div>

            <div className="form-group">
              <label>Verify Token</label>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <input 
                  className="form-input" 
                  style={{ flex: 1 }}
                  type="password"
                  value={settings.verifyToken}
                  onChange={e => setSettings({ ...settings, verifyToken: e.target.value })}
                />
                <button className="copy-btn" onClick={() => copyToClipboard(settings.verifyToken)}><Copy size={16} /></button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Security token for Meta validation.</span>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-xl)' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Subscribed Fields
            </label>
            <div className="subscription-list">
              {['messages', 'statuses', 'message_echoes', 'template_status'].map(f => (
                <div 
                  key={f} 
                  className={`subscription-chip ${subs.includes(f) ? 'active' : ''}`}
                  onClick={() => {
                    const newSubs = subs.includes(f) ? subs.filter(x => x !== f) : [...subs, f]
                    setSettings({ ...settings, subscriptions: newSubs.join(',') })
                  }}
                >
                  <ShieldCheck size={14} /> {f}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              variant="primary" 
              onClick={handleSave} 
              disabled={saving}
              icon={Zap}
            >
              {saving ? 'Saving...' : 'Apply & Sync Settings'}
            </Button>
          </div>
        </div>

        {/* Meta Notice */}
        <div className="meta-notice">
          <Info size={24} color="#60a5fa" />
          <div className="meta-notice-content">
            <div className="meta-notice-title">Manual Action Required at Meta Developer Portal</div>
            <p>
              Due to Meta's security policies, changing the <strong>Callback URL</strong> or <strong>Verify Token</strong> 
              must also be updated manually in your Facebook App Dashboard under <em>WhatsApp &gt; Configuration</em>.
            </p>
            <p style={{ marginTop: 'var(--space-sm)' }}>
              1. Copy the URL and Token above.<br />
              2. Paste them into the Meta Portal.<br />
              3. Click <strong>Verify and Save</strong> at Meta to complete the bridge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
