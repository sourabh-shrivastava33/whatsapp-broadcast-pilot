import React from 'react'
import { Button } from './Button'

export function EmptyState({ icon: Icon, title, description, actionLabel, actionIcon, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionLabel && (
        <Button variant="primary" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
