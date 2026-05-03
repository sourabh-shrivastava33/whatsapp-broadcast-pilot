import config from '../config.js';
/**
 * ContactsContext — manages broadcast recipients.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react'

const ContactsContext = createContext(null)
const API_URL = config.API_URL + "/contacts"

const INITIAL_STATE = { contacts: [], loading: true }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload, loading: false }
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] }
    case 'UPDATE_CONTACT': {
      const contacts = state.contacts.map((c) =>
        c.id === action.payload.id ? { ...c, ...action.payload } : c
      )
      return { ...state, contacts }
    }
    case 'DELETE_CONTACT': {
      const contacts = state.contacts.filter((c) => c.id !== action.payload.id)
      return { ...state, contacts }
    }
    default:
      return state
  }
}

export function ContactsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => dispatch({ type: 'SET_CONTACTS', payload: data }))
      .catch(err => {
        console.error('Failed to fetch contacts', err)
        dispatch({ type: 'SET_CONTACTS', payload: [] })
      })
  }, [])

  return (
    <ContactsContext.Provider value={{ state, dispatch }}>
      {children}
    </ContactsContext.Provider>
  )
}

export function useContacts() {
  const ctx = useContext(ContactsContext)
  if (!ctx) throw new Error('useContacts must be inside ContactsProvider')
  const { state, dispatch } = ctx
  return {
    contacts: state.contacts,
    loading: state.loading,
    
    addContact: async (payload) => {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        dispatch({ type: 'ADD_CONTACT', payload: data })
      } catch (err) {
        console.error(err)
      }
    },
    
    updateContact: async (payload) => {
      try {
        const res = await fetch(`${API_URL}/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        dispatch({ type: 'UPDATE_CONTACT', payload: data })
      } catch (err) {
        console.error(err)
      }
    },
    
    deleteContact: async (id) => {
      try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        dispatch({ type: 'DELETE_CONTACT', payload: { id } })
      } catch (err) {
        console.error(err)
      }
    },
    
    blockContact: async (id) => {
      try {
        const res = await fetch(`${API_URL}/${id}/block`, { method: 'POST' })
        const { contact } = await res.json()
        if (contact) dispatch({ type: 'UPDATE_CONTACT', payload: contact })
      } catch (err) {
        console.error(err)
      }
    },
    
    unblockContact: async (id) => {
      try {
        const res = await fetch(`${API_URL}/${id}/unblock`, { method: 'POST' })
        const { contact } = await res.json()
        if (contact) dispatch({ type: 'UPDATE_CONTACT', payload: contact })
      } catch (err) {
        console.error(err)
      }
    },
  }
}
