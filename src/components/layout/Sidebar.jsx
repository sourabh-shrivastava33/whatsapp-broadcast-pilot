import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  Users,
  FileText,
  Radio,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  MessageSquare,
  Globe,
  Sun,
  Moon,
  Activity,
  X,
  ShieldCheck,
  LogOut,
  Building2,
  ChevronDown
} from 'lucide-react'
import { useTheme } from '../../store/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import './Sidebar.css'

const navGroups = [
  {
    title: 'Management',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/accounts', label: 'Accounts', icon: Smartphone },
      { path: '/health', label: 'Account Health', icon: Activity },
      { path: '/compliance', label: 'Compliance', icon: ShieldCheck },
    ]
  },
  {
    title: 'Marketing',
    items: [
      { path: '/contacts', label: 'Contacts', icon: Users },
      { path: '/media', label: 'Media Library', icon: ImageIcon },
      { path: '/templates', label: 'Templates', icon: FileText },
      { path: '/broadcast', label: 'Broadcast', icon: Radio },
    ]
  },
  {
    title: 'Communication',
    items: [
      { path: '/inbox', label: 'Inbox', icon: MessageSquare },
      { path: '/webhooks', label: 'Webhooks', icon: Globe },
    ]
  }
]

export function Sidebar({ onExpand, onLock, isMobile, isOpen, onClose }) {
  const [expanded, setExpanded] = useState(false)
  const [locked, setLocked] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { logout, user, workspaces, activeWorkspace, selectWorkspace } = useAuth()

  const isActuallyExpanded = isMobile ? isOpen : (expanded || locked);

  const handleExpand = (val) => {
    if (isMobile) return;
    setExpanded(val);
    onExpand?.(val);
  }

  const handleLock = () => {
    const newVal = !locked;
    setLocked(newVal);
    onLock?.(newVal);
  }

  return (
    <aside
      className={`sidebar ${isActuallyExpanded ? 'expanded' : ''} ${locked ? 'locked' : ''} ${isMobile ? 'mobile' : ''} ${isOpen ? 'is-open' : ''}`}
      onMouseEnter={() => handleExpand(true)}
      onMouseLeave={() => handleExpand(false)}
    >
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <MessageCircle size={20} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">WA Broadcast</span>
          <span className="sidebar-brand-label">CRM Demo</span>
        </div>
        {isMobile && (
          <button className="sidebar-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Workspace Switcher */}
      <div className="sidebar-workspace-section">
        <button 
          className="workspace-toggle"
          onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
        >
          <div className="workspace-icon">
            <Building2 size={18} />
          </div>
          {isActuallyExpanded && (
            <>
              <div className="workspace-info">
                <span className="workspace-name">{activeWorkspace?.name || 'Loading...'}</span>
                <span className="workspace-role">Workspace</span>
              </div>
              <ChevronDown size={14} className={`workspace-chevron ${showWorkspaceMenu ? 'rotate' : ''}`} />
            </>
          )}
        </button>

        {showWorkspaceMenu && isActuallyExpanded && (
          <div className="workspace-menu">
            <div className="workspace-menu-title">Switch Workspace</div>
            {workspaces.map(ws => (
              <button 
                key={ws.id}
                className={`workspace-menu-item ${activeWorkspace?.id === ws.id ? 'active' : ''}`}
                onClick={() => {
                  selectWorkspace(ws);
                  setShowWorkspaceMenu(false);
                }}
              >
                {ws.name}
              </button>
            ))}
            <div className="workspace-menu-divider" />
            <button className="workspace-menu-item create">
              + Create Workspace
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="sidebar-nav-group">
            {isActuallyExpanded && <div className="sidebar-nav-title">{group.title}</div>}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                onClick={() => isMobile && onClose()}
                end={item.path === '/'}
              >
                <span className="sidebar-nav-icon">
                  <item.icon size={20} />
                </span>
                <span className="sidebar-nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="sidebar-bottom">
        <button
          className="sidebar-theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span className="sidebar-nav-icon">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </span>
          <span className="sidebar-nav-label">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>
        <button
          className="sidebar-theme-btn"
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) {
              logout();
            }
          }}
          aria-label="Logout"
        >
          <span className="sidebar-nav-icon">
            <LogOut size={18} />
          </span>
          <span className="sidebar-nav-label">Logout</span>
        </button>
      </div>

      {/* Edge Toggle (Desktop Only) */}
      {!isMobile && (
        <button
          className={`sidebar-edge-toggle ${locked ? 'locked' : ''}`}
          onClick={handleLock}
          aria-label="Toggle sidebar lock"
        >
          {locked ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
    </aside>
  )
}
