import React, { useCallback } from 'react'
import Info from 'lucide-react/dist/esm/icons/info'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Server from 'lucide-react/dist/esm/icons/server'

import { useToast } from '../store/ToastContext'
import { useWebhooks } from '../hooks/useWebhooks'
import { WebhooksSkeleton } from './webhooks/WebhooksSkeleton'

// Modular Components
import { StatusHero } from './webhooks/StatusHero'
import { ConfigurationCard } from './webhooks/ConfigurationCard'
import { MetaAutomationCard } from './webhooks/MetaAutomationCard'
import { FieldSubscriptions } from './webhooks/FieldSubscriptions'

import './Webhooks.css'

export default function Webhooks() {
  const { toast } = useToast()
  const {
    settings,
    setSettings,
    systemHealth,
    loading,
    saving,
    testing,
    testResult,
    syncProgress,
    saveSettings,
    testConnection,
    syncToMeta,
    toggleSubscription
  } = useWebhooks()

  const copyToClipboard = useCallback((text) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast({ type: 'info', message: 'Copied to clipboard' })
  }, [toast])

  const handleMetaSync = async () => {
    try {
      await syncToMeta()
    } catch (err) {
      // Error handled by hook's toast
    }
  }

  if (loading) return <WebhooksSkeleton />

  return (
    <div className="page fade-in">
      <div className="webhooks-page">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">Webhook Management</h1>
            <p className="page-subtitle">Architect the real-time bridge between Meta and your CRM.</p>
          </div>
        </div>

        {/* Global Info */}
        <div className="info-hint mb-6">
          <Server size={14} className="info-hint-icon" />
          <div className="info-hint-content">
            <p>Webhooks allow Meta to push real-time updates (like message delivery status and incoming replies) directly to your production server for instant processing.</p>
          </div>
        </div>

        {/* 1. Status Hero */}
        <StatusHero 
          systemHealth={systemHealth} 
          settings={settings} 
          onTest={testConnection} 
          testing={testing} 
        />

        {/* 2. Connection Alerts */}
        {testResult && (
          <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
            {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <div className="alert-content">
              <span className="alert-title">{testResult.success ? 'Connection Healthy' : 'Connection Failed'}</span>
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        {/* 3. Meta Automation & Settings */}
        <div className="webhooks-main-grid">
          <div className="webhooks-column">
            <ConfigurationCard 
              settings={settings} 
              setSettings={setSettings} 
              onCopy={copyToClipboard} 
            />
            
            <div style={{ marginTop: 'var(--space-xl)' }}>
              <FieldSubscriptions 
                subscriptions={settings.subscriptions} 
                onToggle={toggleSubscription} 
              />
            </div>
          </div>

          <div className="webhooks-column">
            <MetaAutomationCard 
              settings={settings}
              onSync={handleMetaSync}
              onSave={() => saveSettings()}
              saving={saving}
              syncProgress={syncProgress}
            />

            {/* Meta Manual Instructions */}
            <div className="meta-notice">
              <Info size={24} color="var(--status-sent)" style={{ flexShrink: 0 }} />
              <div className="meta-notice-content">
                <div className="meta-notice-title">Manual Action Required at Meta</div>
                <p>
                  Security policies require that <strong>Callback URL</strong> and <strong>Verify Token</strong> 
                  be updated manually in your Facebook App Dashboard under <em>WhatsApp &gt; Configuration</em>.
                </p>
                <ul className="meta-notice-steps">
                  <li>Copy the URL and Token from the configuration card.</li>
                  <li>Paste them into the Meta App Dashboard.</li>
                  <li>Click <strong>Verify and Save</strong> at Meta to complete the bridge.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
