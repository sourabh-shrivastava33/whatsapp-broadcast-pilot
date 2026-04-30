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
import { useToast } from '../store/ToastContext'
import { socket } from '../lib/socket'
import './Webhooks.css'

export default function Webhooks() {
  const { toast } = useToast()
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

    const handleSyncUpdate = (data) => {
      if (data.status === 'processing') {
        toast({ type: 'info', message: data.message, duration: 2000 });
      } else if (data.status === 'success') {
        toast({ type: 'success', title: 'Meta Sync', message: data.message });
      } else if (data.status === 'error') {
        toast({ type: 'error', title: 'Sync Error', message: data.message });
      }
    };

    socket.on('sync_status', handleSyncUpdate);
    return () => socket.off('sync_status', handleSyncUpdate);
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
      toast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Your webhook configuration has been updated locally.'
      })
    } catch (err) {
      toast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not save webhook settings.'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    toast({ type: 'loading', message: 'Testing connection...' })
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
        toast({ type: 'success', title: 'Healthy', message: 'Webhook verified!' })
      } else {
        setSettings(prev => ({ ...prev, healthStatus: 'failing' }))
        toast({ type: 'error', title: 'Failing', message: data.message })
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message })
      toast({ type: 'error', title: 'Test Error', message: err.message })
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
            <div className="alert-content">
              <span className="alert-title">{testResult.success ? 'Connection Healthy' : 'Connection Failed'}</span>
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        {settings.metaError && (
          <div className="meta-error-card">
            <div className="meta-error-icon">
              <AlertCircle size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="alert-title">Meta Automation Failure</span>
                <span className="meta-status-badge status-failed">Sync Failed</span>
              </div>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>{settings.metaError}</span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleTest()}
              style={{ borderColor: 'rgba(218, 54, 51, 0.3)' }}
            >
              Retry
            </Button>
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

          <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)' }}>
            <Button 
              variant="outline" 
              onClick={async () => {
                setSaving(true);
                const tId = toast({ type: 'loading', message: 'Synchronizing with Meta...' });
                try {
                  const res = await fetch('http://localhost:3001/api/webhook-settings/meta-sync', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    toast({ type: 'success', title: 'Meta Sync Complete', message: data.message });
                  } else {
                    throw new Error(data.error);
                  }
                  
                  const sRes = await fetch('http://localhost:3001/api/webhook-settings');
                  const sData = await sRes.json();
                  setSettings(sData);
                } catch (err) {
                  toast({ type: 'error', title: 'Sync Failed', message: err.message });
                } finally {
                  setSaving(false);
                }
              }} 
              disabled={saving || !settings.url}
              icon={RefreshCcw}
            >
              Sync to Meta
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSave} 
              disabled={saving}
              icon={Zap}
            >
              {saving ? 'Saving...' : 'Save Locally'}
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
