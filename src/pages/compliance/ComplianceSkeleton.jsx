import React, { memo } from 'react'

export const ComplianceSkeleton = memo(() => {
  return (
    <div className="page compliance-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="skeleton-pulse" style={{ height: '32px', width: '250px', marginBottom: '8px', borderRadius: '4px' }} />
          <div className="skeleton-pulse" style={{ height: '20px', width: '350px', borderRadius: '4px' }} />
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '12px' }}>
          <div className="skeleton-pulse" style={{ height: '40px', width: '120px', borderRadius: '8px' }} />
          <div className="skeleton-pulse" style={{ height: '40px', width: '150px', borderRadius: '8px' }} />
        </div>
      </div>

      <div className="skeleton-pulse" style={{ height: '60px', width: '100%', marginBottom: '24px', borderRadius: '8px' }} />

      <div className="comp-stats-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="comp-stat-card skeleton-pulse" style={{ height: '100px', border: 'none' }} />
        ))}
      </div>

      <div className="comp-toolbar" style={{ marginTop: '24px' }}>
        <div className="skeleton-pulse" style={{ height: '40px', width: '300px', borderRadius: '8px' }} />
        <div className="skeleton-pulse" style={{ height: '40px', width: '250px', borderRadius: '8px' }} />
      </div>

      <div className="comp-table-container" style={{ marginTop: '24px' }}>
        <div className="skeleton-pulse" style={{ height: '400px', width: '100%', borderRadius: '12px' }} />
      </div>
    </div>
  )
})

ComplianceSkeleton.displayName = 'ComplianceSkeleton'
