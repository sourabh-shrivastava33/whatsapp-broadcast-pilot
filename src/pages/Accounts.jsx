import React, { useState } from 'react'
import {
  Smartphone, Plus, CheckCircle, Building2, ToggleLeft, ToggleRight,
  Trash2, Star, RefreshCw, AlertCircle, Wifi
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
                  <Smartphone size={22} />
                </div>
                <div className="account-card-info">
                  <div className="account-card-name">{account.displayName}</div>
                  <div className="account-card-number">{account.displayPhoneNumber || account.phoneNumberId}</div>
                  {account.businessLabel && (
                    <div className="account-card-waba">
                      <Building2 size={11} /> {account.businessLabel}
                    </div>
                  )}
                </div>
                {account.id === activeAccountId && (
                  <Chip label="Active" status="approved" />
                )}
              </div>

              {/* Status Row */}
              <div className="account-card-status-row">
                <div className="status-pill">
                  <Wifi size={12} />
                  <span>{account.isActive ? 'Enabled' : 'Disabled'}</span>
                </div>
                {account.qualityRating && (
                  <div className="quality-pill">
                    {QUALITY_LABEL[account.qualityRating] || account.qualityRating}
                  </div>
                )}
                {account.wabaId && (
                  <div className="waba-id-pill">WABA: {account.wabaId.slice(0, 8)}…</div>
                )}
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
