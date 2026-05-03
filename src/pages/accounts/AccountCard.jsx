import React, { useState, memo } from 'react'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Wifi from 'lucide-react/dist/esm/icons/wifi'
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Info from 'lucide-react/dist/esm/icons/info'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up'
import Zap from 'lucide-react/dist/esm/icons/zap'
import { QualityBadge } from './QualityBadge'

export const AccountCard = memo(({ account, onToggle, onDelete }) => {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)

  const handleToggle = async (e) => {
    e.stopPropagation()
    if (toggling) return
    setToggling(true)
    try { await onToggle(account) } finally { setToggling(false) }
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onDelete(account)
  }

  return (
    <div className={`account-card ${account.isActive ? 'is-active' : 'is-inactive'} ${!account.isActive ? 'dimmed' : ''}`}>
      <div className="account-card-header">
        <div className="account-card-identity">
          <div className={`account-status-ring ${account.isActive ? 'ring-active' : ''}`}>
            <Smartphone size={18} aria-hidden="true" />
          </div>
          <div className="account-card-info">
            <span className="account-phone">{account.displayPhoneNumber || account.phoneNumberId}</span>
            <span className="account-name">{account.displayName || 'WhatsApp Business'}</span>
          </div>
        </div>

        <div className="account-card-controls">
          {account.isActive && (
            <span className="active-pill">
              <CheckCircle2 size={11} aria-hidden="true" />
              Active
            </span>
          )}
          <button
            className={`toggle-switch ${account.isActive ? 'toggle-on' : 'toggle-off'} ${toggling ? 'toggling' : ''}`}
            onClick={handleToggle}
            disabled={toggling}
            aria-label={account.isActive ? 'Disable account' : 'Enable account'}
            title={account.isActive ? 'Click to disable' : 'Click to enable'}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="account-stats-row">
        <div className="account-stat">
          <span className="stat-label">Quality</span>
          <QualityBadge rating={account.qualityRating || 'UNKNOWN'} />
        </div>
        <div className="account-stat">
          <span className="stat-label">Status</span>
          <span className={`connection-badge ${account.isActive ? 'connected' : 'offline'}`}>
            {account.isActive ? <Wifi size={11} aria-hidden="true" /> : <WifiOff size={11} aria-hidden="true" />}
            {account.isActive ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="account-stat">
          <span className="stat-label">Tier</span>
          <span className="tier-badge">
            <Zap size={11} aria-hidden="true" />
            {account.messagingLimitTier?.replace('TIER_', '') || '—'}
          </span>
        </div>
      </div>

      <button
        className="expand-toggle"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded && (
        <div className="account-details fade-in">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">
                WABA ID
                <span className="info-icon-wrapper" data-tooltip="WhatsApp Business Account ID"><Info size={10} aria-hidden="true" /></span>
              </span>
              <span className="detail-value mono">{account.wabaId || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">
                Phone ID
                <span className="info-icon-wrapper" data-tooltip="Unique identifier for this phone number"><Info size={10} aria-hidden="true" /></span>
              </span>
              <span className="detail-value mono">{account.phoneNumberId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Verified Name</span>
              <span className="detail-value">{account.verifiedName || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Account Mode</span>
              <span className={`mode-badge ${account.accountMode === 'LIVE' ? 'live' : 'sandbox'}`}>
                {account.accountMode === 'LIVE' ? '🟢 Live' : '🔵 Sandbox'}
              </span>
            </div>
          </div>

          <div className="account-actions">
            <button
              className="acct-action danger"
              onClick={handleDelete}
            >
              <Trash2 size={13} aria-hidden="true" />
              Remove Account
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

AccountCard.displayName = 'AccountCard'
