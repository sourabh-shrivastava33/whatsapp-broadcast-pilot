import React, { memo } from 'react'
import User from 'lucide-react/dist/esm/icons/user'

export const ConversationItem = memo(({ conv, isActive, onClick }) => {
  return (
    <div 
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="conversation-avatar">
        <User size={20} />
        {conv.isWindowOpen && <div className="online-indicator" />}
      </div>
      <div className="conversation-info">
        <div className="info-top">
          <span className="contact-name">{conv.name}</span>
          <span className="last-time">
            {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <div className="info-bottom">
          <span className="last-message">
            {conv.chatMessages?.[0]?.body || 'Passive lead'}
          </span>
          {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
        </div>
      </div>
    </div>
  )
})

ConversationItem.displayName = 'ConversationItem'
