import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Smartphone } from 'lucide-react'
import { useAccounts } from '../../store/AccountsContext'
import './AccountSelector.css'

export function AccountSelector({ expanded }) {
  const { accounts, activeAccount, setActiveAccount } = useAccounts()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (accounts.length === 0) {
    return null
  }

  return (
    <div className={`account-selector ${expanded ? 'expanded' : ''}`} ref={dropdownRef}>
      <button 
        className="account-selector-button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Account"
        title={activeAccount ? activeAccount.displayName : 'Select Account'}
      >
        <div className="account-selector-icon">
          <Smartphone size={18} />
        </div>
        {expanded && (
          <>
            <div className="account-selector-text">
              <span className="account-selector-name">
                {activeAccount ? activeAccount.displayName : 'No Account'}
              </span>
              <span className="account-selector-label">
                {activeAccount?.businessLabel || 'Active Account'}
              </span>
            </div>
            <ChevronDown size={14} className="account-selector-chevron" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="account-selector-dropdown">
          <div className="account-selector-header">Switch Account</div>
          <div className="account-selector-list">
            {accounts.map((account) => (
              <button
                key={account.id}
                className={`account-selector-item ${activeAccount?.id === account.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveAccount(account.id)
                  setIsOpen(false)
                }}
              >
                <div className="account-selector-item-text">
                  <span className="account-selector-item-name">{account.displayName}</span>
                  <span className="account-selector-item-phone">{account.phoneNumberId}</span>
                </div>
                {activeAccount?.id === account.id && <Check size={16} className="account-selector-item-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
