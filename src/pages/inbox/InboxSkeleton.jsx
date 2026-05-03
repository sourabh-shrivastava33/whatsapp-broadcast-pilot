import React, { memo } from 'react'

export const InboxSkeleton = memo(() => {
  return (
    <div className="page inbox-page">
      <aside className="inbox-sidebar">
        <div className="sidebar-header">
          <div className="skeleton-pulse" style={{ height: '32px', width: '100px', marginBottom: '16px', borderRadius: '4px' }} />
          <div className="inbox-tabs">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-pulse" style={{ height: '32px', flex: 1, borderRadius: '4px' }} />
            ))}
          </div>
          <div className="skeleton-pulse" style={{ height: '40px', width: '100%', marginTop: '12px', borderRadius: '8px' }} />
        </div>
        
        <div className="conversation-list">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="conversation-item" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="skeleton-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div className="conversation-info" style={{ marginLeft: '12px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="skeleton-pulse" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
                  <div className="skeleton-pulse" style={{ height: '12px', width: '40px', borderRadius: '4px' }} />
                </div>
                <div className="skeleton-pulse" style={{ height: '14px', width: '160px', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-main hide-on-mobile">
        <div className="empty-chat-main">
          <div className="skeleton-pulse" style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '24px' }} />
          <div className="skeleton-pulse" style={{ height: '32px', width: '250px', marginBottom: '12px', borderRadius: '4px' }} />
          <div className="skeleton-pulse" style={{ height: '20px', width: '400px', borderRadius: '4px' }} />
        </div>
      </main>
    </div>
  )
})

InboxSkeleton.displayName = 'InboxSkeleton'
