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
  MessageCircle,
  Sun,
  Moon
} from 'lucide-react'
import { useTheme } from '../../store/ThemeContext'
import { AccountSelector } from './AccountSelector'
import './Sidebar.css'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/accounts', label: 'Accounts', icon: Smartphone },
  { path: '/contacts', label: 'Contacts', icon: Users },
  { path: '/media', label: 'Media Library', icon: ImageIcon },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/broadcast', label: 'Broadcast', icon: Radio },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <aside
      className={`sidebar ${expanded ? 'expanded' : ''}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
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
      </div>

      <AccountSelector expanded={expanded} />

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            end={item.path === '/'}
          >
            <span className="sidebar-nav-icon">
              <item.icon size={20} />
            </span>
            <span className="sidebar-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="sidebar-bottom">
        <button
          className="sidebar-theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span className="sidebar-nav-icon">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </span>
          <span className="sidebar-nav-label">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>
      </div>

      {/* Toggle */}
      <div className="sidebar-toggle">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setExpanded(!expanded)}
          aria-label="Toggle sidebar"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </aside>
  )
}

