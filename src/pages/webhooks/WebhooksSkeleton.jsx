import React, { memo } from 'react'

export const WebhooksSkeleton = memo(() => {
  return (
    <div className="page webhooks-page">
      <div className="page-header">
        <div className="skeleton-pulse" style={{ height: '32px', width: '250px', marginBottom: '8px', borderRadius: '4px' }} />
        <div className="skeleton-pulse" style={{ height: '20px', width: '350px', borderRadius: '4px' }} />
      </div>

      <div className="skeleton-pulse" style={{ height: '50px', width: '100%', marginBottom: '24px', borderRadius: '8px' }} />

      <div className="status-hero" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="status-content">
          <div className="skeleton-pulse" style={{ height: '24px', width: '200px', marginBottom: '12px', borderRadius: '4px' }} />
          <div className="skeleton-pulse" style={{ height: '16px', width: '300px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton-pulse" style={{ height: '40px', width: '150px', borderRadius: '8px' }} />
      </div>

      <div className="webhooks-main-grid">
        <div className="webhooks-column">
          <div className="config-card" style={{ height: '300px' }}>
            <div className="skeleton-pulse" style={{ height: '24px', width: '180px', marginBottom: '32px' }} />
            <div className="skeleton-pulse" style={{ height: '60px', width: '100%', marginBottom: '20px' }} />
            <div className="skeleton-pulse" style={{ height: '60px', width: '100%' }} />
          </div>
          <div className="subscriptions-section" style={{ height: '200px' }}>
            <div className="skeleton-pulse" style={{ height: '20px', width: '150px', marginBottom: '20px' }} />
            <div className="subscription-grid">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-pulse" style={{ height: '60px', borderRadius: '12px' }} />)}
            </div>
          </div>
        </div>
        <div className="webhooks-column">
          <div className="meta-automation-card" style={{ height: '250px' }}>
            <div className="skeleton-pulse" style={{ height: '40px', width: '40px', borderRadius: '10px', marginBottom: '16px' }} />
            <div className="skeleton-pulse" style={{ height: '24px', width: '200px', marginBottom: '8px' }} />
            <div className="skeleton-pulse" style={{ height: '16px', width: '150px' }} />
          </div>
          <div className="meta-notice" style={{ height: '150px' }}>
            <div className="skeleton-pulse" style={{ height: '24px', width: '24px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-pulse" style={{ height: '18px', width: '200px', marginBottom: '12px' }} />
              <div className="skeleton-pulse" style={{ height: '40px', width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

WebhooksSkeleton.displayName = 'WebhooksSkeleton'
