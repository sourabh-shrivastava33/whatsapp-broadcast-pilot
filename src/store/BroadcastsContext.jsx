import config from '../config.js';
/**
 * BroadcastsContext — manages broadcast records.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const BroadcastsContext = createContext(null)
const API_URL = config.API_URL + "/broadcasts"

const INITIAL_STATE = { broadcasts: [], loading: true }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true }
    case 'SET_BROADCASTS':
      return { ...state, broadcasts: action.payload, loading: false }
    case 'ADD_BROADCAST':
      return { ...state, broadcasts: [...state.broadcasts, action.payload] }
    case 'UPDATE_BROADCAST': {
      const broadcasts = state.broadcasts.map((b) =>
        b.id === action.payload.id ? { ...b, ...action.payload } : b
      )
      return { ...state, broadcasts }
    }
    default:
      return state
  }
}

export function BroadcastsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const { authFetch, activeWorkspace } = useAuth()

  const fetchBroadcasts = useCallback(async () => {
    if (!activeWorkspace) return;
    dispatch({ type: 'SET_LOADING' });
    try {
      const res = await authFetch(API_URL);
      const data = await res.json();
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_BROADCASTS', payload: data });
      } else {
        console.error('API did not return an array:', data);
        dispatch({ type: 'SET_BROADCASTS', payload: [] });
      }
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
      dispatch({ type: 'SET_BROADCASTS', payload: [] });
    }
  }, [authFetch, activeWorkspace]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const actions = {
    addBroadcast: async (payload) => {
      try {
        const res = await authFetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (res.ok) {
          dispatch({ type: 'ADD_BROADCAST', payload: data })
        } else {
          throw new Error(data.error || 'Failed to create broadcast')
        }
      } catch (err) {
        console.error(err)
      }
    },
    
    updateBroadcast: async (payload) => {
      try {
        const res = await authFetch(`${API_URL}/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        dispatch({ type: 'UPDATE_BROADCAST', payload: data })
      } catch (err) {
        console.error(err)
      }
    },
  };

  return (
    <BroadcastsContext.Provider value={{ state, ...actions }}>
      {children}
    </BroadcastsContext.Provider>
  )
}

export function useBroadcasts() {
  const ctx = useContext(BroadcastsContext)
  if (!ctx) throw new Error('useBroadcasts must be inside BroadcastsProvider')
  return {
    ...ctx,
    broadcasts: ctx.state.broadcasts,
    loading: ctx.state.loading,
  }
}
