import React from 'react'

import { X } from 'lucide-react';

export function Chip({ label, status = 'default', className = '', onRemove, icon: Icon }) {
  return (
    <span className={`chip chip-${status} ${onRemove ? 'removable' : ''} ${className}`}>
      {Icon && <Icon size={12} />}
      {!Icon && status !== 'default' && <span className="chip-dot" />}
      {label}
      {onRemove && (
        <button className="chip-remove" onClick={onRemove}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}

export function FilterChip({ label, active, onClick }) {
  return (
    <button
      className={`chip chip-filter ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
