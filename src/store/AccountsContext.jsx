/**
 * AccountsContext — manages WhatsApp account connections.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react'

const AccountsContext = createContext(null)
const API_URL = 'http://localhost:3001/api/accounts'

const INITIAL_STATE = {
  accounts: [],
  activeAccountId: localStorage.getItem('wa_crm_active_account') || null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload }
    case 'ADD_ACCOUNT': {
      const accounts = [...state.accounts, action.payload]
      const activeAccountId = state.activeAccountId ?? action.payload.id
      localStorage.setItem('wa_crm_active_account', activeAccountId)
      return { ...state, accounts, activeAccountId }
    }
    case 'UPDATE_ACCOUNT': {
      const accounts = state.accounts.map((a) =>
        a.id === action.payload.id ? { ...a, ...action.payload } : a
      )
      return { ...state, accounts }
    }
    case 'DELETE_ACCOUNT': {
      const accounts = state.accounts.filter((a) => a.id !== action.payload.id)
      const activeAccountId =
        state.activeAccountId === action.payload.id
          ? accounts[0]?.id ?? null
          : state.activeAccountId
      if (activeAccountId) localStorage.setItem('wa_crm_active_account', activeAccountId)
      else localStorage.removeItem('wa_crm_active_account')
      return { ...state, accounts, activeAccountId }
    }
    case 'SET_ACTIVE_ACCOUNT':
      localStorage.setItem('wa_crm_active_account', action.payload.id)
      return { ...state, activeAccountId: action.payload.id }
    default:
      return state
  }
}

export function AccountsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => dispatch({ type: 'SET_ACCOUNTS', payload: data }))
      .catch(err => console.error('Failed to fetch accounts', err))
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

  return {
    accounts: state.accounts,
    activeAccountId: state.activeAccountId,
    activeAccount: state.accounts.find((a) => a.id === state.activeAccountId) ?? null,
    
    // addAccount accepts an already-saved account object (e.g. from MetaDiscoveryModal)
    // and adds it to local state without another API call.
    addAccount: (savedAccount) => {
      dispatch({ type: 'ADD_ACCOUNT', payload: savedAccount })
    },
    
    updateAccount: async (payload) => {
      try {
        const res = await fetch(`${API_URL}/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        dispatch({ type: 'UPDATE_ACCOUNT', payload: data })
      } catch (err) {
        console.error(err)
      }
    },
    
    deleteAccount: async (id) => {
      try {
        const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete account');
        }
        dispatch({ type: 'DELETE_ACCOUNT', payload: { id } })
      } catch (err) {
        console.error(err)
        alert(err.message)
      }
    },
    
    setActiveAccount: (id) => dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: { id } }),
  }
}
