import React from 'react'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { Button } from '../../components/ui/Button'

export function MetaAutomationCard({ settings, onSync, onSave, saving, syncProgress }) {
  const isFailed = settings.metaStatus === 'sync_failed'
  const isSynced = settings.metaStatus === 'synchronized'

  return (
    <div className="meta-automation-card">
      <div className="automation-header">
        <div className="automation-title-group">
          <Zap size={18} className="automation-icon" />
          <div>
            <h3 className="automation-title">Meta Cloud API Bridge</h3>
            <p className="automation-subtitle">Automate app subscriptions and WABA event hooks.</p>
          </div>
        </div>
        <div className={`meta-status-badge status-${settings.metaStatus}`}>
          {(settings.metaStatus || 'unknown').replace('_', ' ')}
        </div>
      </div>

      {isFailed && (
        <div className="meta-error-notice">
          <div className="meta-error-icon">
            <AlertCircle size={20} />
          </div>
          <div className="meta-error-content">
            <strong>Automation Failure</strong>
            <p>{settings.metaError || 'An unknown error occurred during synchronization.'}</p>
          </div>
        </div>
      )}

      {syncProgress && (
        <div className="sync-progress-bar">
          <Loader2 size={14} className="spin" />
          <span>{syncProgress.message}</span>
        </div>
      )}

      <div className="automation-actions">
        <Button 
          variant="outline" 
          icon={RefreshCcw} 
          onClick={onSync} 
          disabled={saving || !settings.url}
          loading={saving && !!syncProgress}
        >
          {syncProgress ? 'Synchronizing...' : 'Sync to Meta'}
        </Button>
        <Button 
          variant="primary" 
          icon={Zap} 
          onClick={onSave} 
          disabled={saving}
          loading={saving && !syncProgress}
        >
          {saving && !syncProgress ? 'Saving...' : 'Save Locally'}
        </Button>
      </div>
    </div>
  )
}
