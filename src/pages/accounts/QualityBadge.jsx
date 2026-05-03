import React, { memo } from 'react'

// Quality rating display map
const QUALITY_CONFIG = {
  GREEN:   { label: 'High Quality',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  dot: '#10b981' },
  YELLOW:  { label: 'Medium Quality', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: '#f59e0b' },
  RED:     { label: 'Low Quality',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   dot: '#ef4444' },
  UNKNOWN: { label: 'Unknown',        color: '#6e7681', bg: 'rgba(110,118,129,0.12)', dot: '#6e7681' },
}

export const QualityBadge = memo(({ rating }) => {
  const cfg = QUALITY_CONFIG[rating] ?? QUALITY_CONFIG.UNKNOWN
  return (
    <span className="quality-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="quality-dot" style={{ background: cfg.dot }} aria-hidden="true" />
      {cfg.label}
    </span>
  )
})

QualityBadge.displayName = 'QualityBadge'
