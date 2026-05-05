import React from 'react'
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw'
import { Button } from '../../components/ui/Button'

export function StatusHero({ systemHealth, settings, onTest, testing }) {
  const isReady = systemHealth.status === 'READY'
  const isFailing = systemHealth.status === 'WEBHOOK_FAIL'
  
  return (
    <div className="status-hero">
      <div className="status-content">
        <div className="pulse-indicator">
          <div className={`pulse-dot ${isReady ? 'active' : isFailing ? 'error' : 'unknown'}`} />
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold' }}>
            System Readiness: {isReady ? 'READY' : (systemHealth.status || 'unknown').replace('_', ' ')}
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {systemHealth.details || 'System status is being analyzed...'}
        </p>
        {settings.lastSyncAt && (
          <p className="last-sync-tag">
            Last Meta Sync: {new Date(settings.lastSyncAt).toLocaleString()}
          </p>
        )}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Button 
          variant="outline" 
          icon={RefreshCcw} 
          onClick={onTest} 
          disabled={testing}
          loading={testing}
        >
          {testing ? 'Verifying...' : 'Test Connection'}
        </Button>
      </div>
    </div>
  )
}
