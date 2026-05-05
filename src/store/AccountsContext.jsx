import config from '../config.js';
/**
 * AccountsContext — manages WhatsApp account connections.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const AccountsContext = createContext(null)
const API_BASE = config.API_URL + "/accounts"

const INITIAL_STATE = {
  accounts: [],
  loading: true,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true }
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
  const { authFetch, activeWorkspace } = useAuth()

  const fetchAccounts = useCallback(async () => {
    if (!activeWorkspace) return;
    dispatch({ type: 'SET_LOADING' });
    try {
      const res = await authFetch(API_BASE);
      const data = await res.json();
      dispatch({ type: 'SET_ACCOUNTS', payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      dispatch({ type: 'SET_ACCOUNTS', payload: [] });
    }
  }, [authFetch, activeWorkspace]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const actions = {
    addAccount: (savedAccount) => {
      dispatch({ type: 'ADD_ACCOUNT', payload: savedAccount })
    },

    updateAccount: (updatedAccount) => {
      dispatch({ type: 'UPDATE_ACCOUNT', payload: updatedAccount })
    },

    toggleAccount: async (account) => {
      const endpoint = account.isActive
        ? `${API_BASE}/${account.id}/disable`
        : `${API_BASE}/${account.id}/enable`
      try {
        const res = await authFetch(endpoint, { method: 'PUT' })
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
        const res = await authFetch(`${API_BASE}/${id}`, { method: 'DELETE' })
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

    setActiveAccount: async (id) => {
      try {
        const res = await authFetch(`${API_BASE}/${id}/enable`, { method: 'PUT' })
        if (!res.ok) throw new Error('Enable failed')
        const data = await res.json()
        dispatch({ type: 'UPDATE_ACCOUNT', payload: data })
      } catch (err) {
        console.error('setActiveAccount error:', err)
      }
    },
  };

  return (
    <AccountsContext.Provider value={{ state, dispatch, ...actions }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error('useAccounts must be inside AccountsProvider')
  const { state, dispatch, ...actions } = ctx

  const activeAccounts = state.accounts.filter((a) => a.isActive && !a.isArchived)
  const primaryAccount = activeAccounts[0] ?? null

  return {
    ...actions,
    accounts: state.accounts,
    activeAccounts,
    primaryAccount,
    activeAccountId: primaryAccount?.id ?? null,
    activeAccount: primaryAccount,
    loading: state.loading,
  }
}
