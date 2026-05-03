import React from 'react'
import Globe from 'lucide-react/dist/esm/icons/globe'
import Copy from 'lucide-react/dist/esm/icons/copy'

export function ConfigurationCard({ settings, setSettings, onCopy }) {
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
              style={{ flex: 1 }}
              placeholder="https://your-ngrok-url.app/api/webhooks"
              value={settings.url}
              onChange={e => setSettings({ ...settings, url: e.target.value })}
            />
            <button className="copy-btn" onClick={() => onCopy(settings.url)} type="button">
              <Copy size={16} />
            </button>
          </div>
          <span className="form-hint-text">Expose your local port 3001 using ngrok.</span>
        </div>

        <div className="form-group">
          <label>Verify Token</label>
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <input 
              className="form-input" 
              style={{ flex: 1 }}
              type="password"
              placeholder="Secure token for Meta"
              value={settings.verifyToken}
              onChange={e => setSettings({ ...settings, verifyToken: e.target.value })}
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
