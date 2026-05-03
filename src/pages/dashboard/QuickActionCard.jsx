import React, { memo } from 'react'

export const QuickActionCard = memo(({ action, onClick }) => (
  <button
    className="quick-action-card"
    onClick={onClick}
    aria-label={action.title}
  >
    <div className="quick-action-icon">
      <action.icon size={20} aria-hidden="true" />
    </div>
    <div className="quick-action-text">
      <h3>{action.title}</h3>
      <p>{action.description}</p>
    </div>
  </button>
))

QuickActionCard.displayName = 'QuickActionCard'
