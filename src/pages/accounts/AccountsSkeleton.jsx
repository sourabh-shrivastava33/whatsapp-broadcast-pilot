import React from 'react'

export const AccountsSkeleton = () => {
  return (
    <div className="page accounts-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="skeleton-text" style={{ width: '120px', height: '28px' }} />
          <div className="skeleton-text" style={{ width: '240px', height: '16px', marginTop: '12px' }} />
        </div>
        <div className="page-actions">
          <div className="skeleton-text" style={{ width: '130px', height: '40px', borderRadius: '8px' }} />
        </div>
      </div>

      <div className="waba-groups-container">
        {[1, 2].map((i) => (
          <div key={i} className="waba-group">
            <div className="waba-group-header">
              <div className="waba-group-identity">
                <div className="waba-group-icon skeleton-pulse" />
                <div>
                  <div className="skeleton-text" style={{ width: '180px', height: '16px' }} />
                  <div className="skeleton-text" style={{ width: '120px', height: '12px', marginTop: '6px' }} />
                </div>
              </div>
              <div className="waba-group-meta">
                <div className="skeleton-text" style={{ width: '80px', height: '24px', borderRadius: '12px' }} />
              </div>
            </div>
            <div className="waba-accounts-list">
              {[1, 2].map((j) => (
                <div key={j} className="account-card" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                  <div className="account-card-header">
                    <div className="account-card-identity">
                      <div className="account-status-ring skeleton-pulse" />
                      <div className="account-card-info">
                        <div className="skeleton-text" style={{ width: '120px', height: '14px' }} />
                        <div className="skeleton-text" style={{ width: '100px', height: '12px', marginTop: '4px' }} />
                      </div>
                    </div>
                    <div className="skeleton-text" style={{ width: '40px', height: '22px', borderRadius: '11px' }} />
                  </div>
                  <div className="account-stats-row" style={{ marginTop: '16px' }}>
                    {[1, 2, 3].map((k) => (
                      <div key={k} className="account-stat">
                        <div className="skeleton-text" style={{ width: '40px', height: '10px' }} />
                        <div className="skeleton-text" style={{ width: '60px', height: '20px', marginTop: '6px', borderRadius: '10px' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
