import config from '../config.js';
/**
 * ContactsContext — manages broadcast recipients.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { socket } from '../lib/socket'
import { useAuth } from '../contexts/AuthContext'

const ContactsContext = createContext(null)
const API_URL = config.API_URL + "/contacts"

const INITIAL_STATE = { contacts: [], loading: true }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true }
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload, loading: false }
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] }
    case 'UPSERT_CONTACT': {
      const exists = state.contacts.some((c) => c.id === action.payload.id)
      const contacts = exists
        ? state.contacts.map((c) => (c.id === action.payload.id ? { ...c, ...action.payload } : c))
        : [action.payload, ...state.contacts]
      return { ...state, contacts }
    }
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
  const { authFetch, activeWorkspace } = useAuth()

  const fetchContacts = useCallback(async () => {
    if (!activeWorkspace) return;
    dispatch({ type: 'SET_LOADING' });
    try {
      const res = await authFetch(API_URL)
      const data = await res.json()
      dispatch({ type: 'SET_CONTACTS', payload: Array.isArray(data) ? data : [] })
      return data
    } catch (err) {
      console.error('Failed to fetch contacts', err)
      dispatch({ type: 'SET_CONTACTS', payload: [] })
      return []
    }
  }, [authFetch, activeWorkspace])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  useEffect(() => {
    const upsertContact = (contact) => {
      if (contact?.id) dispatch({ type: 'UPSERT_CONTACT', payload: contact })
    }
    const handleNewMessage = (payload) => upsertContact(payload?.contact)

    socket.on('new_message', handleNewMessage)
    socket.on('contact_updated', upsertContact)
    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('contact_updated', upsertContact)
    }
  }, [])

  const actions = {
    addContact: async (payload) => {
      try {
        const res = await authFetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        dispatch({ type: 'UPSERT_CONTACT', payload: data })
      } catch (err) {
        console.error(err)
      }
    },
    
    updateContact: async (payload) => {
      try {
        const res = await authFetch(`${API_URL}/${payload.id}`, {
          method: 'PATCH',
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
        await authFetch(`${API_URL}/${id}`, { method: 'DELETE' })
        dispatch({ type: 'DELETE_CONTACT', payload: { id } })
      } catch (err) {
        console.error(err)
      }
    },
    
    blockContact: async (id) => {
      try {
        const res = await authFetch(`${API_URL}/${id}/block`, { method: 'POST' })
        const { contact } = await res.json()
        if (contact) dispatch({ type: 'UPDATE_CONTACT', payload: contact })
      } catch (err) {
        console.error(err)
      }
    },
    
    unblockContact: async (id) => {
      try {
        const res = await authFetch(`${API_URL}/${id}/unblock`, { method: 'POST' })
        const { contact } = await res.json()
        if (contact) dispatch({ type: 'UPDATE_CONTACT', payload: contact })
      } catch (err) {
        console.error(err)
      }
    },
  };

  return (
    <ContactsContext.Provider value={{ state, dispatch, fetchContacts, ...actions }}>
      {children}
    </ContactsContext.Provider>
  )
}

export function useContacts() {
  const ctx = useContext(ContactsContext)
  if (!ctx) throw new Error('useContacts must be inside ContactsProvider')
  return {
    ...ctx,
    contacts: ctx.state.contacts,
    loading: ctx.state.loading,
  }
}
