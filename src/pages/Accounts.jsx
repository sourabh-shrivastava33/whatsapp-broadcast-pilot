import React, { useState } from 'react'
import {
  Smartphone, Building2, CheckCircle2, Wifi, WifiOff,
  Trash2, ToggleLeft, ToggleRight, Info, Plus,
  ChevronDown, ChevronUp, ShieldCheck, Zap
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { MetaDiscoveryModal } from '../components/ui/MetaDiscoveryModal'
import { useAccounts } from '../store/AccountsContext'
import { useToast } from '../store/ToastContext'
import './Accounts.css'

// Quality rating display map
const QUALITY_CONFIG = {
  GREEN:   { label: 'High Quality',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  dot: '#10b981' },
  YELLOW:  { label: 'Medium Quality', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: '#f59e0b' },
  RED:     { label: 'Low Quality',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   dot: '#ef4444' },
  UNKNOWN: { label: 'Unknown',        color: '#6e7681', bg: 'rgba(110,118,129,0.12)', dot: '#6e7681' },
}

function QualityBadge({ rating }) {
  const cfg = QUALITY_CONFIG[rating] ?? QUALITY_CONFIG.UNKNOWN
  return (
    <span className="quality-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="quality-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function AccountCard({ account, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleToggle = async (e) => {
    e.stopPropagation()
    setToggling(true)
    try { await onToggle(account) } finally { setToggling(false) }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!window.confirm(`Remove ${account.displayPhoneNumber || account.phoneNumberId}?`)) return
    setDeleting(true)
    try { await onDelete(account.id) } finally { setDeleting(false) }
  }

  return (
    <div className={`account-card ${account.isActive ? 'is-active' : 'is-inactive'} ${!account.isActive ? 'dimmed' : ''}`}>
      {/* ── Card Top Row ──────────────────────────────── */}
      <div className="account-card-header">
        <div className="account-card-identity">
          <div className={`account-status-ring ${account.isActive ? 'ring-active' : ''}`}>
            <Smartphone size={18} />
          </div>
          <div className="account-card-info">
            <span className="account-phone">{account.displayPhoneNumber || account.phoneNumberId}</span>
            <span className="account-name">{account.displayName || 'WhatsApp Business'}</span>
          </div>
        </div>

        <div className="account-card-controls">
          {account.isActive && (
            <span className="active-pill">
              <CheckCircle2 size={11} />
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

      {/* ── Quick Stats Row ───────────────────────────── */}
      <div className="account-stats-row">
        <div className="account-stat">
          <span className="stat-label">Quality</span>
          <QualityBadge rating={account.qualityRating || 'UNKNOWN'} />
        </div>
        <div className="account-stat">
          <span className="stat-label">Status</span>
          <span className={`connection-badge ${account.isActive ? 'connected' : 'offline'}`}>
            {account.isActive ? <Wifi size={11} /> : <WifiOff size={11} />}
            {account.isActive ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="account-stat">
          <span className="stat-label">Tier</span>
          <span className="tier-badge">
            <Zap size={11} />
            {account.messagingLimitTier?.replace('TIER_', '') || '—'}
          </span>
        </div>
      </div>

      {/* ── Expandable Details ────────────────────────── */}
      <button
        className="expand-toggle"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded && (
        <div className="account-details fade-in">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">
                WABA ID
                <span className="info-icon-wrapper" data-tooltip="WhatsApp Business Account ID"><Info size={10} /></span>
              </span>
              <span className="detail-value mono">{account.wabaId || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">
                Phone ID
                <span className="info-icon-wrapper" data-tooltip="Unique identifier for this phone number"><Info size={10} /></span>
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
              disabled={deleting}
            >
              <Trash2 size={13} />
              {deleting ? 'Removing…' : 'Remove Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function WabaGroup({ wabaId, accounts, onToggle, onDelete }) {
  const businessName = accounts[0]?.businessName || accounts[0]?.displayName || 'Business Account'
  const activeCount = accounts.filter((a) => a.isActive).length

  return (
    <div className="waba-group">
      <div className="waba-group-header">
        <div className="waba-group-identity">
          <div className="waba-group-icon">
            <Building2 size={16} />
          </div>
          <div>
            <div className="waba-group-name">{businessName}</div>
            <div className="waba-group-id">WABA · {wabaId}</div>
          </div>
        </div>
        <div className="waba-group-meta">
          <span className="waba-count-badge">
            {accounts.length} number{accounts.length !== 1 ? 's' : ''}
          </span>
          {activeCount > 0 && (
            <span className="waba-active-count">
              {activeCount} active
            </span>
          )}
        </div>
      </div>

      <div className="waba-accounts-list">
        {accounts.map((acc) => (
          <AccountCard
            key={acc.id}
            account={acc}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

export default function Accounts() {
  const [showImport, setShowImport] = useState(false)
  const { accounts, addAccount, toggleAccount, deleteAccount } = useAccounts()
  const { toast } = useToast()

  // Group accounts by WABA ID
  const grouped = accounts.reduce((map, acc) => {
    const key = acc.wabaId || acc.id
    if (!map[key]) map[key] = []
    map[key].push(acc)
    return map
  }, {})

  const wabaGroups = Object.entries(grouped)
  const totalActive = accounts.filter((a) => a.isActive).length

  const handleToggle = async (account) => {
    try {
      await toggleAccount(account)
      toast({
        type: 'success',
        title: account.isActive ? 'Account disabled' : 'Account enabled',
        message: account.isActive
          ? `${account.displayPhoneNumber} will no longer send broadcasts.`
          : `${account.displayPhoneNumber} is now active for broadcasts.`,
      })
    } catch {
      toast({ type: 'error', title: 'Failed', message: 'Could not update account status.' })
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAccount(id)
      toast({ type: 'success', title: 'Removed', message: 'Account removed successfully.' })
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message })
    }
  }

  return (
    <div className="page fade-in accounts-page">
      {/* ── Page Header ──────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">
            {accounts.length > 0
              ? `${accounts.length} number${accounts.length !== 1 ? 's' : ''} across ${wabaGroups.length} WABA${wabaGroups.length !== 1 ? 's' : ''} · ${totalActive} active`
              : 'Connect WhatsApp numbers from Meta Business Manager'}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={Plus} onClick={() => setShowImport(true)}>
            Add Account
          </Button>
        </div>
      </div>

      {/* ── Multi-Active Info Banner ──────────────────── */}
      {accounts.length > 1 && (
        <div className="info-hint" style={{ marginBottom: 'var(--space-xl)' }}>
          <ShieldCheck size={16} className="info-hint-icon" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <p>
            <strong>Multi-Account Broadcasting:</strong> Toggle multiple numbers active at once. Broadcasts will be distributed proportionally across all active accounts based on their messaging tier limits.
          </p>
        </div>
      )}

      {/* ── Content ───────────────────────────────────── */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No accounts connected"
          description="Import your WhatsApp phone numbers from Meta Business Manager. You'll need your WABA ID and a System User Access Token."
          actionLabel="Add Account"
          actionIcon={Building2}
          onAction={() => setShowImport(true)}
        />
      ) : (
        <div className="waba-groups-container">
          {wabaGroups.map(([wabaId, accs]) => (
            <WabaGroup
              key={wabaId}
              wabaId={wabaId}
              accounts={accs}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <MetaDiscoveryModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
      />
    </div>
  )
}
