import React, { useState, useMemo } from 'react'
import { Users, UserPlus, Search, Phone, Pencil, Trash2, Tag } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { ContactFormModal } from '../components/ui/ContactFormModal'
import { useContacts } from '../store/ContactsContext'
import './Contacts.css'

export default function Contacts() {
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [deletingContact, setDeletingContact] = useState(null)
  const [search, setSearch] = useState('')
  const { contacts, deleteContact } = useContacts()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  }, [contacts, search])

  const openAdd = () => {
    setEditingContact(null)
    setShowFormModal(true)
  }

  const openEdit = (contact) => {
    setEditingContact(contact)
    setShowFormModal(true)
  }

  const handleDelete = () => {
    if (deletingContact) {
      deleteContact(deletingContact.id)
      setDeletingContact(null)
    }
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">
            {contacts.length > 0
              ? `${contacts.length} recipient${contacts.length !== 1 ? 's' : ''} in your list`
              : 'Manage your broadcast recipients'}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={UserPlus} onClick={openAdd}>
            Add Contact
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="contacts-toolbar">
        <div className="search-bar">
          <Search size={16} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Search by name, phone, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="contacts-count">
          {filtered.length === contacts.length
            ? `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${contacts.length}`}
        </span>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts added yet"
          description="Add contacts to build your recipient list. You can add them individually or import in bulk later."
          actionLabel="Add Contact"
          actionIcon={UserPlus}
          onAction={openAdd}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results found"
          description={`No contacts match "${search}". Try a different search.`}
        />
      ) : (
        <div className="contacts-list">
          {filtered.map((contact) => (
            <div key={contact.id} className="contact-row">
              <div className="contact-avatar">
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-phone">
                  <Phone size={11} />
                  {contact.phone}
                </div>
              </div>

              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <div className="contact-tags">
                  {contact.tags.map((tag) => (
                    <span key={tag} className="contact-tag">
                      <Tag size={9} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Row actions */}
              <div className="contact-actions">
                <button
                  className="contact-action-btn"
                  onClick={() => openEdit(contact)}
                  aria-label="Edit contact"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="contact-action-btn danger"
                  onClick={() => setDeletingContact(contact)}
                  aria-label="Delete contact"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <ContactFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        editContact={editingContact}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deletingContact}
        onClose={() => setDeletingContact(null)}
        title="Delete Contact"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingContact(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deletingContact?.name}</strong>? 
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}


