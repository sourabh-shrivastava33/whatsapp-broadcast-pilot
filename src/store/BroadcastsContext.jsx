import config from '../config.js';
/**
 * BroadcastsContext — manages broadcast records.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react'

const BroadcastsContext = createContext(null)
const API_URL = config.API_URL + "/broadcasts"

const INITIAL_STATE = { broadcasts: [], loading: true }

function reducer(state, action) {
  switch (action.type) {
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

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_BROADCASTS', payload: data })
        } else {
          console.error('API did not return an array:', data)
          dispatch({ type: 'SET_BROADCASTS', payload: [] })
        }
      })
      .catch(err => {
        console.error('Failed to fetch broadcasts', err)
        dispatch({ type: 'SET_BROADCASTS', payload: [] })
      })
  }, [])

  return (
    <BroadcastsContext.Provider value={{ state, dispatch }}>
      {children}
    </BroadcastsContext.Provider>
  )
}

export function useBroadcasts() {
  const ctx = useContext(BroadcastsContext)
  if (!ctx) throw new Error('useBroadcasts must be inside BroadcastsProvider')
  const { state, dispatch } = ctx

  return {
    broadcasts: state.broadcasts,
    loading: state.loading,
    
    addBroadcast: async (payload) => {
      try {
        const res = await fetch(API_URL, {
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
        const res = await fetch(`${API_URL}/${payload.id}`, {
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
  }
}
