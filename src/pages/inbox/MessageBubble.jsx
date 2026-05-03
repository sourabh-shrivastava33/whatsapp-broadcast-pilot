import React, { memo } from 'react'
import Paperclip from 'lucide-react/dist/esm/icons/paperclip'
import CheckCheck from 'lucide-react/dist/esm/icons/check-check'

export const MessageBubble = memo(({ msg }) => {
  return (
    <div className={`message-wrapper ${msg.fromMe ? 'outgoing' : 'incoming'}`}>
      <div className="message-bubble">
        {msg.type === 'template_broadcast' && <span className="message-type-tag">Broadcast Campaign</span>}
        {msg.mediaUrl && (
          <div className="message-media">
            {msg.type === 'image' || (msg.type === 'template_broadcast' && msg.mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i)) ? (
              <img src={msg.mediaUrl} alt="Sent" onClick={() => window.open(msg.mediaUrl, '_blank')} />
            ) : msg.type === 'video' ? (
              <video src={msg.mediaUrl} controls />
            ) : (
              <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="document-link">
                <Paperclip size={16} /> 
                <span className="file-label">{msg.body || 'Attachment'}</span>
              </a>
            )}
          </div>
        )}
        <div className="message-body">{msg.body}</div>
        <div className="message-footer">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.fromMe && <CheckCheck size={14} className={`status-icon ${msg.status || 'sent'}`} />}
        </div>
      </div>
    </div>
  )
})

MessageBubble.displayName = 'MessageBubble'
