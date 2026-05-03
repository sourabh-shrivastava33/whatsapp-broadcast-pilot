import React from 'react'

export const DashboardSkeleton = () => {
  return (
    <div className="page dashboard-skeleton-root">
      {/* Greeting Skeleton */}
      <div className="dashboard-greeting">
        <div className="skeleton-pulse" style={{ height: '32px', width: '240px', marginBottom: '8px', borderRadius: '8px' }} />
        <div className="skeleton-pulse" style={{ height: '20px', width: '320px', borderRadius: '6px' }} />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="dashboard-stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card-skeleton skeleton-pulse" />
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <h2 className="dashboard-section-title">Broadcast Performance</h2>
      <div className="skeleton-pulse" style={{ height: '300px', width: '100%', borderRadius: '16px', marginBottom: 'var(--space-3xl)', background: 'var(--bg-card-muted)' }} />

      {/* Quick Actions Skeleton */}
      <h2 className="dashboard-section-title">Quick Actions</h2>
      <div className="quick-actions">
        {[1, 2, 3].map((i) => (
          <div key={i} className="quick-action-skeleton skeleton-pulse" />
        ))}
      </div>

      {/* Recent Activity Skeleton */}
      <h2 className="dashboard-section-title">Recent Activity</h2>
      <div className="activity-feed">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="skeleton-pulse" 
            style={{ 
              height: '48px', 
              margin: '12px var(--space-xl)', 
              borderRadius: '8px',
              opacity: 1 - (i * 0.2)
            }} 
          />
        ))}
      </div>
    </div>
  )
}
