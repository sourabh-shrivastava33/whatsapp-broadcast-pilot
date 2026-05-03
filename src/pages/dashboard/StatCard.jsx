import React, { memo } from 'react'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import Users from 'lucide-react/dist/esm/icons/users'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Radio from 'lucide-react/dist/esm/icons/radio'

export const StatCard = memo(({ stat, idx, onClick }) => (
  <button
    className="stat-card"
    style={{ animationDelay: `${idx * 80}ms` }}
    onClick={onClick}
    aria-label={`View ${stat.label}`}
  >
    <div className={`stat-card-icon ${stat.color}`}>
      <stat.icon size={22} aria-hidden="true" />
    </div>
    <div className="stat-card-info">
      <div className="stat-card-value">{stat.value}</div>
      <div className="stat-card-label">{stat.label}</div>
    </div>
  </button>
))

StatCard.displayName = 'StatCard'
