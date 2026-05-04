import React, { useState, useEffect } from 'react'
import Menu from 'lucide-react/dist/esm/icons/menu'
import X from 'lucide-react/dist/esm/icons/x'
import { CommandStrip } from './CommandStrip'
import './AppLayout.css'

const Sidebar = React.lazy(() => import('./Sidebar').then(m => ({ default: m.Sidebar })))

export function AppLayout({ children }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarLocked, setIsSidebarLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidth = isMobile 
    ? '0' 
    : (isSidebarExpanded || isSidebarLocked) ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)';

  return (
    <div className={`app-layout ${isMobile ? 'is-mobile' : ''}`}>
      <div className="bg-gradient-mesh" />
      <CommandStrip />
      
      {isMobile && (
        <header className="mobile-header">
          <div className="mobile-header-side">
            <button 
              className="mobile-menu-btn" 
              onClick={() => setShowMobileMenu(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          </div>
          <div className="mobile-logo">WA Broadcast</div>
          <div className="mobile-header-side" />
        </header>
      )}

      <React.Suspense fallback={<div className="sidebar-placeholder" />}>
        <Sidebar 
          onExpand={setIsSidebarExpanded} 
          onLock={setIsSidebarLocked}
          isMobile={isMobile}
          isOpen={showMobileMenu}
          onClose={() => setShowMobileMenu(false)}
        />
      </React.Suspense>

      {isMobile && showMobileMenu && (
        <div className="mobile-backdrop" onClick={() => setShowMobileMenu(false)} />
      )}

      <main 
        className="app-content" 
        style={{ 
          marginLeft: isMobile ? '0' : sidebarWidth,
          paddingTop: isMobile 
            ? 'calc(var(--command-strip-height) + var(--mobile-header-height) + 16px)' 
            : `calc(var(--command-strip-height) + 20px)`,
          paddingBottom: isMobile ? '80px' : '20px',
          paddingLeft: isMobile ? '16px' : '40px',
          paddingRight: isMobile ? '16px' : '40px',
        }}
      >
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  )
}
