import React, { memo, useMemo } from 'react'
import CheckCheck from 'lucide-react/dist/esm/icons/check-check'
import Play from 'lucide-react/dist/esm/icons/play'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import ImageIcon from 'lucide-react/dist/esm/icons/image'
import VideoIcon from 'lucide-react/dist/esm/icons/video'
import { formatWhatsAppText } from '../../utils/richTextParser'
import './WhatsAppPreview.css'

function replaceSamples(text, samples) {
  if (!text) return ''
  return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
    return samples[num] ? `[${samples[num]}]` : match
  })
}

export const WhatsAppPreview = memo(({ 
  header, 
  body, 
  footer, 
  buttons = [], 
  sampleValues = {},
  headerType = 'TEXT',
  mediaUrl = '',
  limitedTimeOffer = null
}) => {
  const previewBody = useMemo(() => 
    body ? formatWhatsAppText(replaceSamples(body, sampleValues)) : null,
    [body, sampleValues]
  )

  const previewHeader = useMemo(() => 
    header && headerType === 'TEXT' ? formatWhatsAppText(replaceSamples(header, sampleValues)) : null,
    [header, headerType, sampleValues]
  )

  const hasContent = header || body || footer || buttons.length > 0 || mediaUrl

  const currentTime = useMemo(() => 
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    []
  )

  return (
    <div className="wa-preview-shell">
      <div className="wa-preview-phone">
        {/* Status bar */}
        <div className="wa-phone-bar">
          <div className="wa-phone-bar-left">
            <div className="wa-phone-back">‹</div>
            <div className="wa-phone-avatar" />
            <div className="wa-phone-name-group">
              <div className="wa-phone-name">Business Name</div>
              <ShieldCheck size={12} className="wa-verified-badge" />
            </div>
          </div>
          <div className="wa-phone-icons">
            <span className="wa-icon-more">⋮</span>
          </div>
        </div>

        {/* Chat area */}
        <div className="wa-phone-chat">
          <div className="wa-chat-date">Today</div>

          {hasContent ? (
            <div className="wa-bubble">
              {limitedTimeOffer && (
                <div className="wa-lto-banner">
                  <div className="wa-lto-badge">OFFER</div>
                  <div className="wa-lto-text">{limitedTimeOffer.text}</div>
                  <div className="wa-lto-countdown">Ends in 02:45:10</div>
                </div>
              )}
              {headerType !== 'TEXT' ? (
                <div className="wa-bubble-header-media">
                  {headerType === 'IMAGE' && mediaUrl ? (
                    <img src={mediaUrl} alt="Header" className="wa-header-img" loading="lazy" />
                  ) : headerType === 'VIDEO' && mediaUrl ? (
                    <div className="wa-header-video-wrapper">
                      <img src={mediaUrl} alt="Video Preview" className="wa-header-img" loading="lazy" />
                      <div className="wa-play-overlay">
                        <Play size={24} fill="white" />
                      </div>
                    </div>
                  ) : (
                    <div className="wa-header-placeholder">
                      <span className="wa-header-icon">
                        {headerType === 'IMAGE' ? <ImageIcon size={24} /> : headerType === 'VIDEO' ? <VideoIcon size={24} /> : <FileText size={24} />}
                      </span>
                      <span className="wa-header-label">{headerType}</span>
                    </div>
                  )}
                </div>
              ) : previewHeader ? (
                <div className="wa-bubble-header">{previewHeader}</div>
              ) : null}

              {previewBody ? (
                <div className="wa-bubble-body">
                  {previewBody}
                </div>
              ) : (
                <div className="wa-bubble-body wa-bubble-placeholder">
                  Your message will appear here…
                </div>
              )}

              {footer && (
                <div className="wa-bubble-footer">{footer}</div>
              )}

              <div className="wa-bubble-time">
                {currentTime}
                {' '}<CheckCheck size={14} className="wa-read-receipt" />
              </div>

              {/* Bubble Tail SVG */}
              <div className="wa-bubble-tail">
                <svg viewBox="0 0 8 13" width="8" height="13">
                  <path d="M5.188 0H0v11.193l6.467-8.273C7.335 1.965 6.67 0 5.188 0z" fill="white" />
                </svg>
              </div>

              {buttons.length > 0 && (
                <div className="wa-bubble-buttons">
                  {buttons.map((btn, i) => {
                    let icon = null;
                    if (btn.type === 'PHONE_NUMBER') icon = '📞 ';
                    if (btn.type === 'URL') icon = '🔗 ';
                    if (btn.type === 'CATALOG') icon = '🛒 ';
                    if (btn.type === 'OTP') icon = '📋 ';
                    
                    return (
                      <button key={i} className="wa-bubble-btn">
                        {icon}{btn.text || (btn.type === 'OTP' ? 'Copy Code' : 'Button')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="wa-preview-empty">
              <p>Start typing to see your template preview</p>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="wa-phone-input-bar">
          <div className="wa-phone-input-field">Type a message</div>
          <div className="wa-phone-send">➤</div>
        </div>
      </div>
    </div>
  )
})

WhatsAppPreview.displayName = 'WhatsAppPreview'
