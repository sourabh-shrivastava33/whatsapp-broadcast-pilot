import React, { memo } from 'react'

export const TemplatesSkeleton = memo(() => {
  return (
    <div className="templates-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="skeleton-pulse" style={{ height: '32px', width: '200px', marginBottom: '8px', borderRadius: '4px' }} />
          <div className="skeleton-pulse" style={{ height: '20px', width: '300px', borderRadius: '4px' }} />
        </div>
        <div className="page-actions">
          <div className="skeleton-pulse" style={{ height: '40px', width: '140px', borderRadius: '8px' }} />
          <div className="skeleton-pulse" style={{ height: '40px', width: '160px', borderRadius: '8px' }} />
        </div>
      </div>

      <div className="filter-bar">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-pulse" style={{ height: '32px', width: '80px', borderRadius: '16px' }} />
        ))}
      </div>

      <div className="templates-list">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="template-card skeleton-pulse" style={{ height: '82px', border: 'none' }} />
        ))}
      </div>
    </div>
  )
})

TemplatesSkeleton.displayName = 'TemplatesSkeleton'
