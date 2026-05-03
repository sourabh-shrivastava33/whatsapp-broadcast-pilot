import React, { memo } from 'react'
import Phone from 'lucide-react/dist/esm/icons/phone'
import Tag from 'lucide-react/dist/esm/icons/tag'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'

export const ContactRow = memo(({ contact, onEdit, onDelete }) => (
  <div className="contact-row">
    <div className="contact-avatar">
      {(contact.name || '?').charAt(0).toUpperCase()}
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
        onClick={() => onEdit(contact)}
        aria-label="Edit contact"
        title="Edit"
      >
        <Pencil size={14} />
      </button>
      <button
        className="contact-action-btn danger"
        onClick={() => onDelete(contact)}
        aria-label="Delete contact"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </div>
))

ContactRow.displayName = 'ContactRow'
