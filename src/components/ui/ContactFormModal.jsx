import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useContacts } from '../../store/ContactsContext'

/**
 * ContactFormModal — Add or Edit a contact.
 *
 * Props:
 *   isOpen      — modal visibility
 *   onClose     — close handler
 *   editContact — if provided, switches to edit mode
 */
export function ContactFormModal({ isOpen, onClose, editContact = null }) {
  const { addContact, updateContact } = useContacts()
  const isEdit = !!editContact

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    tags: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})

  // Populate form when editing or reset when opening
  useEffect(() => {
    if (isOpen) {
      if (editContact) {
        setFormData({
          name: editContact.name || '',
          phone: editContact.phone || '',
          tags: (editContact.tags || []).join(', '),
          notes: editContact.notes || '',
        })
      } else {
        setFormData({ name: '', phone: '', tags: '', notes: '' })
      }
      setErrors({})
    }
  }, [isOpen, editContact])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!/^\+?[\d\s\-()]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Enter a valid phone number (e.g. +91 98765 43210)'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return

    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (isEdit) {
      updateContact({
        id: editContact.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        tags,
        notes: formData.notes.trim(),
      })
    } else {
      addContact({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        tags,
        notes: formData.notes.trim(),
      })
    }
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Add Contact'}
          </Button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          type="text"
          placeholder="e.g. John Doe"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          className={errors.name ? 'error' : ''}
          autoFocus
        />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="contact-phone">Phone Number</label>
        <input
          id="contact-phone"
          type="tel"
          placeholder="e.g. +91 98765 43210"
          value={formData.phone}
          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
          className={errors.phone ? 'error' : ''}
        />
        {errors.phone && <span className="form-error">{errors.phone}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="contact-tags">
          Tags <span className="form-label-optional">(Optional, comma-separated)</span>
        </label>
        <input
          id="contact-tags"
          type="text"
          placeholder="e.g. VIP, Europe, Lead"
          value={formData.tags}
          onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="contact-notes">
          Notes <span className="form-label-optional">(Optional)</span>
        </label>
        <input
          id="contact-notes"
          type="text"
          placeholder="Any notes about this contact"
          value={formData.notes}
          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
        />
      </div>
    </Modal>
  )
}
