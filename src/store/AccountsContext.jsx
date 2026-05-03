import config from '../config.js';
/**
 * AccountsContext — manages WhatsApp account connections.
 *
 * Multi-account design:
 *  - Multiple accounts can be `isActive: true` simultaneously.
 *  - `activeAccounts` is the array of all active accounts.
 *  - `primaryAccount` is the first active account (backward compat).
 *  - `activeAccountId` is kept for any legacy callers but derived from primary.
 *  - Toggling an account enables it if inactive, disables it if active.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react'

const AccountsContext = createContext(null)
const API_BASE = config.API_URL + "/accounts"

const INITIAL_STATE = {
  accounts: [],
  loading: true,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload, loading: false }

    case 'ADD_ACCOUNT':
      return {
        ...state,
        accounts: [...state.accounts, action.payload],
      }

    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a
        ),
      }

    case 'DELETE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
      }

    default:
      return state
  }
}

export function AccountsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  useEffect(() => {
    fetch(API_BASE)
      .then((res) => res.json())
      .then((data) => dispatch({ type: 'SET_ACCOUNTS', payload: Array.isArray(data) ? data : [] }))
      .catch((err) => {
        console.error('Failed to fetch accounts:', err)
        dispatch({ type: 'SET_ACCOUNTS', payload: [] })
      })
  }, [])

  return (
    <AccountsContext.Provider value={{ state, dispatch }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error('useAccounts must be inside AccountsProvider')
  const { state, dispatch } = ctx

  // Derived: all currently active accounts
  const activeAccounts = state.accounts.filter((a) => a.isActive && !a.isArchived)

  // Derived: first active account (backward compat for any single-account callers)
  const primaryAccount = activeAccounts[0] ?? null

  return {
    accounts: state.accounts,
    activeAccounts,
    primaryAccount,

    // Legacy compat — derived from primary, not from localStorage
    activeAccountId: primaryAccount?.id ?? null,
    activeAccount: primaryAccount,

    loading: state.loading,

    addAccount: (savedAccount) => {
      dispatch({ type: 'ADD_ACCOUNT', payload: savedAccount })
    },

    updateAccount: (updatedAccount) => {
      dispatch({ type: 'UPDATE_ACCOUNT', payload: updatedAccount })
    },

    /**
     * Toggles an account's isActive state by calling the appropriate backend endpoint.
     * Multiple accounts can be active simultaneously.
     */
    toggleAccount: async (account) => {
      const endpoint = account.isActive
        ? `${API_BASE}/${account.id}/disable`
        : `${API_BASE}/${account.id}/enable`
      try {
        const res = await fetch(endpoint, { method: 'PUT' })
        if (!res.ok) throw new Error('Toggle failed')
        const data = await res.json()
        dispatch({ type: 'UPDATE_ACCOUNT', payload: data })
        return data
      } catch (err) {
        console.error('toggleAccount error:', err)
        throw err
      }
    },

    deleteAccount: async (id) => {
      try {
        const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to delete account')
        }
        dispatch({ type: 'DELETE_ACCOUNT', payload: id })
      } catch (err) {
        console.error('deleteAccount error:', err)
        throw err
      }
    },

    // Legacy compat — calls enable on the given ID, used by old code
    setActiveAccount: async (id) => {
      const account = state.accounts.find((a) => a.id === id)
      if (!account) return
      try {
        const res = await fetch(`${API_BASE}/${id}/enable`, { method: 'PUT' })
        if (!res.ok) throw new Error('Enable failed')
        const data = await res.json()
        dispatch({ type: 'UPDATE_ACCOUNT', payload: data })
      } catch (err) {
        console.error('setActiveAccount error:', err)
      }
    },
  }
}
