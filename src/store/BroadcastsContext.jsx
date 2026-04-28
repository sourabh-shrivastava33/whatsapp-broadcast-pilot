/**
 * BroadcastsContext — manages broadcast records.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react'

const BroadcastsContext = createContext(null)
const API_URL = 'http://localhost:3001/api/broadcasts'

const INITIAL_STATE = { broadcasts: [] }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_BROADCASTS':
      return { ...state, broadcasts: action.payload }
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
      .then(data => dispatch({ type: 'SET_BROADCASTS', payload: data }))
      .catch(err => console.error('Failed to fetch broadcasts', err))
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
    
    addBroadcast: async (payload) => {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        dispatch({ type: 'ADD_BROADCAST', payload: data })
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
