import React from 'react'

export function Chip({ label, status, className = '' }) {
  return (
    <span className={`chip chip-${status} ${className}`}>
      <span className="chip-dot" />
      {label}
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
