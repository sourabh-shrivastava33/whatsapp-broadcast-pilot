import React, { useState } from 'react'
import {
  Smartphone, Plus, CheckCircle, Building2, ToggleLeft, ToggleRight,
  Trash2, Star, RefreshCw, AlertCircle, Wifi, Info
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { MetaDiscoveryModal } from '../components/ui/MetaDiscoveryModal'
import { Chip } from '../components/ui/Chip'
import { useAccounts } from '../store/AccountsContext'
import './Accounts.css'

const QUALITY_LABEL = { GREEN: '🟢 High', YELLOW: '🟡 Medium', RED: '🔴 Low', UNKNOWN: '⚪ Unknown' }

export default function Accounts() {
  const [showImport, setShowImport] = useState(false)
  const { accounts, activeAccountId, setActiveAccount, deleteAccount, updateAccount } = useAccounts()

  const handleEnable = async (account) => {
    try {
      const res = await fetch(`http://localhost:3001/api/accounts/${account.id}/enable`, { method: 'PUT' })
      const data = await res.json()
      updateAccount(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDisable = async (account) => {
    try {
      const res = await fetch(`http://localhost:3001/api/accounts/${account.id}/disable`, { method: 'PUT' })
      const data = await res.json()
      updateAccount(data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="page fade-in accounts-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">
            {accounts.length > 0
              ? `${accounts.length} number${accounts.length > 1 ? 's' : ''} connected via Meta Business Manager`
              : 'Import phone numbers from Meta Business Manager'}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={Building2} onClick={() => setShowImport(true)}>
            Import from Meta
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No accounts connected"
          description="Import your WhatsApp phone numbers directly from Meta Business Manager. You'll need your Business Manager ID and a System User Access Token."
          actionLabel="Import from Meta"
          actionIcon={Building2}
          onAction={() => setShowImport(true)}
        />
      ) : (
        <div className="accounts-grid">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`account-card ${account.id === activeAccountId ? 'active' : ''} ${!account.isActive ? 'disabled' : ''}`}
            >
              {/* Card Header */}
              <div className="account-card-header" onClick={() => setActiveAccount(account.id)}>
                <div className="account-card-icon">
                  <Smartphone size={24} />
                </div>
                <div className="account-card-info">
                  <div className="account-card-number-large">{account.displayPhoneNumber || account.phoneNumberId}</div>
                  <div className="account-card-name-sub">{account.displayName}</div>
                  {account.businessLabel && (
                    <div className="account-card-waba-label">
                      <Building2 size={12} /> {account.businessLabel}
                    </div>
                  )}
                </div>
                {account.id === activeAccountId && (
                  <div className="active-badge">
                    <CheckCircle size={14} />
                    Active
                  </div>
                )}
              </div>

              {/* Account Details Grid */}
              <div className="account-details-grid">
                <div className="detail-item">
                  <span className="detail-label">
                    WABA ID
                    <span className="info-icon-wrapper" data-tooltip="WhatsApp Business Account ID from Meta">
                      <Info size={10} />
                    </span>
                  </span>
                  <span className="detail-value">{account.wabaId || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">
                    Phone ID
                    <span className="info-icon-wrapper" data-tooltip="Unique identifier for this specific phone number">
                      <Info size={10} />
                    </span>
                  </span>
                  <span className="detail-value">{account.phoneNumberId}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">
                    Quality
                    <span className="info-icon-wrapper" data-tooltip="Meta quality rating based on customer feedback">
                      <Info size={10} />
                    </span>
                  </span>
                  <span className={`quality-badge ${account.qualityRating?.toLowerCase()}`}>
                    {QUALITY_LABEL[account.qualityRating] || account.qualityRating || 'Unknown'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">
                    Status
                    <span className="info-icon-wrapper" data-tooltip="Real-time connection status to Meta API">
                      <Info size={10} />
                    </span>
                  </span>
                  <span className={`status-badge ${account.isActive ? 'online' : 'offline'}`}>
                    <Wifi size={10} />
                    {account.isActive ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="account-card-actions">
                <button
                  className="acct-action-btn"
                  title="Set as Active"
                  onClick={() => setActiveAccount(account.id)}
                >
                  <Star size={15} />
                  Set Active
                </button>

                {account.isActive ? (
                  <button
                    className="acct-action-btn warning"
                    title="Disable"
                    onClick={() => handleDisable(account)}
                  >
                    <ToggleLeft size={15} />
                    Disable
                  </button>
                ) : (
                  <button
                    className="acct-action-btn success"
                    title="Enable"
                    onClick={() => handleEnable(account)}
                  >
                    <ToggleRight size={15} />
                    Enable
                  </button>
                )}

                <button
                  className="acct-action-btn danger"
                  title="Remove"
                  onClick={() => deleteAccount(account.id)}
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MetaDiscoveryModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  )
}
