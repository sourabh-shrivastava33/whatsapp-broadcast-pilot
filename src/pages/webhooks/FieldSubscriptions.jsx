import React from 'react'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import Info from 'lucide-react/dist/esm/icons/info'

const AVAILABLE_FIELDS = [
  { id: 'messages', label: 'Inbound Messages', desc: 'Required for receiving customer replies.' },
  { id: 'statuses', label: 'Message Statuses', desc: 'Track Sent, Delivered, and Read updates.' },
  { id: 'message_echoes', label: 'Message Echoes', desc: 'Sync messages sent from other devices.' },
  { id: 'template_status', label: 'Template Updates', desc: 'Get notified when templates are approved.' },
]

export function FieldSubscriptions({ subscriptions, onToggle }) {
  const subs = (subscriptions || '').split(',').filter(Boolean)

  return (
    <div className="subscriptions-section">
      <div className="section-header">
        <h4 className="section-label">Event Subscriptions</h4>
        <div className="tooltip-container">
          <Info size={14} className="text-muted" />
          <div className="tooltip-content">
            Toggle which WhatsApp events should trigger a webhook update to your CRM.
          </div>
        </div>
      </div>

      <div className="subscription-grid">
        {AVAILABLE_FIELDS.map(field => (
          <div 
            key={field.id} 
            className={`subscription-item ${subs.includes(field.id) ? 'active' : ''}`}
            onClick={() => onToggle(field.id)}
          >
            <div className="sub-check">
              <div className="sub-checkbox">
                {subs.includes(field.id) && <ShieldCheck size={14} />}
              </div>
            </div>
            <div className="sub-info">
              <span className="sub-label">{field.label}</span>
              <span className="sub-desc">{field.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
