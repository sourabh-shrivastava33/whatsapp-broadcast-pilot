import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import Building2 from 'lucide-react/dist/esm/icons/building-2'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { useAccounts } from '../store/AccountsContext'
import { useToast } from '../store/ToastContext'

// Modular components
import { WabaGroup } from './accounts/WabaGroup'
import { AccountsSkeleton } from './accounts/AccountsSkeleton'
import './Accounts.css'

// Lazy load heavy modal
const MetaDiscoveryModal = lazy(() => import('../components/ui/MetaDiscoveryModal').then(m => ({ default: m.MetaDiscoveryModal })))

export default function Accounts() {
  const [showImport, setShowImport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { accounts, loading, toggleAccount, deleteAccount } = useAccounts()
  const { toast } = useToast()

  // Ensure accounts is always an array
  const safeAccounts = useMemo(() => Array.isArray(accounts) ? accounts : [], [accounts])

  // Group accounts by WABA ID - Memoized for performance
  // Group accounts by WABA ID - Foolproof defensive logic
  const grouped = useMemo(() => {
    const map = {}
    if (!Array.isArray(safeAccounts)) return map

    safeAccounts.forEach((acc) => {
      if (!acc) return
      
      // Get a safe string key for grouping
      let rawKey = acc.wabaId || acc.id || 'unknown'
      
      // If for some reason rawKey is an object (e.g. Symbol or null-prototype object),
      // String() might throw. We use a double-guard.
      let key = 'unknown'
      try {
        if (typeof rawKey === 'symbol') key = rawKey.toString()
        else if (rawKey && typeof rawKey === 'object') {
          // If it's an object, we use its id or a generic fallback
          key = rawKey.id ? String(rawKey.id) : 'complex-id'
        } else {
          key = String(rawKey)
        }
      } catch (e) {
        key = 'fallback-id'
      }
      
      if (!map[key]) map[key] = []
      map[key].push(acc)
    })
    return map
  }, [safeAccounts])

  const wabaGroups = Object.entries(grouped)
  const totalActive = useMemo(() => safeAccounts.filter((a) => a.isActive).length, [safeAccounts])

  const handleToggle = useCallback(async (account) => {
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
  }, [toggleAccount, toast])

  const handleDeleteRequest = useCallback((account) => {
    setConfirmDelete(account)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    try {
      await deleteAccount(confirmDelete.id)
      toast({ type: 'success', title: 'Removed', message: 'Account removed successfully.' })
      setConfirmDelete(null)
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message })
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return <AccountsSkeleton />
  }

  return (
    <div className="page fade-in accounts-page">
      {/* ── Page Header ──────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Accounts</h1>
          <div className="page-subtitle">
            {safeAccounts.length > 0 ? (
              <>
                <span>{safeAccounts.length} number{safeAccounts.length !== 1 ? 's' : ''}</span>
                <span className="subtitle-sep">across</span>
                <span>{wabaGroups.length} WABA{wabaGroups.length !== 1 ? 's' : ''}</span>
                <span className="subtitle-dot">·</span>
                <span className="active-count">{totalActive} active</span>
              </>
            ) : (
              'Connect WhatsApp numbers from Meta Business Manager'
            )}
          </div>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={Plus} onClick={() => setShowImport(true)}>
            Add Account
          </Button>
        </div>
      </div>

      {/* ── Multi-Active Info Banner ──────────────────── */}
      {safeAccounts.length > 1 && (
        <div className="info-hint" style={{ marginBottom: 'var(--space-xl)' }}>
          <ShieldCheck size={16} className="info-hint-icon" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <p>
            <strong>Multi-Account Broadcasting:</strong> Toggle multiple numbers active at once. Broadcasts will be distributed proportionally across all active accounts based on their messaging tier limits.
          </p>
        </div>
      )}

      {/* ── Content ───────────────────────────────────── */}
      {safeAccounts.length === 0 ? (
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
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        {showImport && (
          <MetaDiscoveryModal
            isOpen={showImport}
            onClose={() => setShowImport(false)}
          />
        )}
      </Suspense>

      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove Account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={isDeleting}>
              {isDeleting ? 'Removing...' : 'Remove Account'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          Are you sure you want to remove the number <strong>{confirmDelete?.displayPhoneNumber || confirmDelete?.phoneNumberId}</strong>? 
          This will stop all active broadcasts for this number.
        </p>
      </Modal>
    </div>
  )
}
