import React, { memo } from 'react'

export const BroadcastSkeleton = memo(() => {
  return (
    <div className="page broadcast-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="skeleton-pulse" style={{ height: '32px', width: '200px', marginBottom: '8px', borderRadius: '4px' }} />
          <div className="skeleton-pulse" style={{ height: '20px', width: '300px', borderRadius: '4px' }} />
        </div>
        <div className="page-actions">
          <div className="skeleton-pulse" style={{ height: '40px', width: '150px', borderRadius: '8px' }} />
        </div>
      </div>

      <div className="broadcasts-list">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="broadcast-row skeleton-pulse" style={{ height: '72px', border: 'none' }} />
        ))}
      </div>
    </div>
  )
})

BroadcastSkeleton.displayName = 'BroadcastSkeleton'
