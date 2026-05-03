import React, { memo } from 'react'
import Building2 from 'lucide-react/dist/esm/icons/building-2'
import { AccountCard } from './AccountCard'

export const WabaGroup = memo(({ wabaId, accounts, onToggle, onDelete }) => {
  const businessName = accounts[0]?.businessName || accounts[0]?.displayName || 'Business Account'
  const activeCount = accounts.filter((a) => a.isActive).length

  return (
    <div className="waba-group">
      <div className="waba-group-header">
        <div className="waba-group-identity">
          <div className="waba-group-icon">
            <Building2 size={16} aria-hidden="true" />
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
})

WabaGroup.displayName = 'WabaGroup'
