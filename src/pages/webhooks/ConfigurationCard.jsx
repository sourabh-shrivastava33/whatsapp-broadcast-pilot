import React from 'react'
import Globe from 'lucide-react/dist/esm/icons/globe'
import Copy from 'lucide-react/dist/esm/icons/copy'
import config from '../../config.js'

export function ConfigurationCard({ settings, setSettings, onCopy }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

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
              name="url"
              style={{ flex: 1, backgroundColor: 'var(--bg-card)' }}
              value={settings.url || ''}
              onChange={handleChange}
              placeholder="https://whatsapp-broadcast-pilot.onrender.com/api/webhooks"
            />
            <button className="copy-btn" onClick={() => onCopy(settings.url)} type="button" title="Copy URL">
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
              name="verifyToken"
              style={{ flex: 1, backgroundColor: 'var(--bg-card)' }}
              type="password"
              value={settings.verifyToken || ''}
              onChange={handleChange}
              placeholder="your_verify_token"
            />
            <button className="copy-btn" onClick={() => onCopy(settings.verifyToken)} type="button" title="Copy Token">
              <Copy size={16} />
            </button>
          </div>
          <span className="form-hint-text">Security token for Meta validation.</span>
        </div>
      </div>
    </div>
  )
}
