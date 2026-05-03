import React, { memo } from 'react'

export const ContactsSkeleton = memo(() => {
  return (
    <div className="page contacts-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="skeleton-pulse" style={{ height: '32px', width: '180px', marginBottom: '8px', borderRadius: '4px' }} />
          <div className="skeleton-pulse" style={{ height: '20px', width: '250px', borderRadius: '4px' }} />
        </div>
        <div className="page-actions">
          <div className="skeleton-pulse" style={{ height: '40px', width: '150px', borderRadius: '8px' }} />
        </div>
      </div>

      <div className="contacts-toolbar">
        <div className="skeleton-pulse" style={{ height: '42px', width: '300px', borderRadius: '8px' }} />
        <div className="skeleton-pulse" style={{ height: '20px', width: '100px', borderRadius: '4px' }} />
      </div>

      <div className="contacts-list">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="contact-row skeleton-pulse" style={{ height: '72px', border: 'none' }} />
        ))}
      </div>
    </div>
  )
})

ContactsSkeleton.displayName = 'ContactsSkeleton'
