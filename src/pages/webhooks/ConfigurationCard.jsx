import React from 'react'
import Globe from 'lucide-react/dist/esm/icons/globe'
import Copy from 'lucide-react/dist/esm/icons/copy'
import config from '../../config.js'

export function ConfigurationCard({ settings, setSettings, onCopy }) {
  const webhookUrl = `${config.API_BASE_URL}/api/webhooks`;

  return (
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
              style={{ flex: 1, backgroundColor: 'var(--bg-card)', cursor: 'not-allowed' }}
              value={webhookUrl}
              readOnly
              disabled
            />
            <button className="copy-btn" onClick={() => onCopy(webhookUrl)} type="button">
              <Copy size={16} />
            </button>
          </div>
          <span className="form-hint-text">Production webhook endpoint for real-time events.</span>
        </div>

        <div className="form-group">
          <label>Verify Token</label>
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <input 
              className="form-input" 
              style={{ flex: 1, backgroundColor: 'var(--bg-card)', cursor: 'not-allowed' }}
              type="text"
              value={settings.verifyToken}
              readOnly
              disabled
            />
            <button className="copy-btn" onClick={() => onCopy(settings.verifyToken)} type="button">
              <Copy size={16} />
            </button>
          </div>
          <span className="form-hint-text">Security token for Meta validation.</span>
        </div>
      </div>
    </div>
  )
}
