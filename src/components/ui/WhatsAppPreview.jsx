import React, { memo, useMemo } from 'react'
import { formatWhatsAppText } from '../../utils/richTextParser'
import { 
  CheckCheck, Play, FileText, ShieldCheck, Image as ImageIcon, 
  Video as VideoIcon, Camera, Plus, Wifi, Signal, Battery, MoreVertical
} from 'lucide-react'
import './WhatsAppPreview.css'

function replaceSamples(text, samples) {
  if (!text) return ''
  return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
    return samples[num] || match
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
  limitedTimeOffer = null,
  variant
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
        {/* Hardware Buttons */}
        <div className="wa-hw-silent"></div>
        <div className="wa-hw-vol-up"></div>
        <div className="wa-hw-vol-down"></div>
        <div className="wa-hw-power"></div>

        {/* Modern Status bar with Notch/Dynamic Island */}
        <div className="wa-phone-status-bar">
          <div className="wa-status-left">9:41</div>
          <div className="wa-dynamic-island">
            <div className="wa-island-inner" />
          </div>
          <div className="wa-status-right">
            <Signal size={12} strokeWidth={2.5} />
            <Wifi size={12} strokeWidth={2.5} />
            <Battery size={14} strokeWidth={2} />
          </div>
        </div>

        {/* WhatsApp App Header */}
        <div className="wa-phone-bar">
          <div className="wa-phone-bar-left">
            <div className="wa-phone-back">‹</div>
            <div className="wa-phone-avatar-wrapper">
              <div className="wa-phone-avatar" />
              <div className="wa-online-indicator" />
            </div>
            <div className="wa-phone-name-group">
              <div className="wa-phone-name-row">
                <span className="wa-phone-name">Business Account</span>
                <ShieldCheck size={13} fill="var(--wa-verified-blue)" stroke="white" className="wa-verified-badge" />
              </div>
              <div className="wa-phone-status">online</div>
            </div>
          </div>
          <div className="wa-phone-icons">
            <MoreVertical size={18} />
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
                    let Icon = null;
                    if (btn.type === 'PHONE_NUMBER') Icon = () => <span style={{ marginRight: '6px' }}>📞</span>;
                    if (btn.type === 'URL') Icon = () => <span style={{ marginRight: '6px' }}>🔗</span>;
                    if (btn.type === 'CATALOG') Icon = () => <span style={{ marginRight: '6px' }}>🛒</span>;
                    if (btn.type === 'OTP') Icon = () => <span style={{ marginRight: '6px' }}>📋</span>;
                    
                    return (
                      <button key={i} className="wa-bubble-btn">
                        {Icon && <Icon />}
                        {btn.text || (btn.type === 'OTP' ? 'Copy Code' : 'Button')}
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

        {/* Realistic Input bar */}
        <div className="wa-phone-input-bar">
          <Plus size={20} className="wa-input-icon" />
          <div className="wa-phone-input-field">
            <span>Message</span>
            <div className="wa-input-right-icons">
              <FileText size={16} />
              <Camera size={16} />
            </div>
          </div>
          <div className="wa-phone-send">
             <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />
          </div>
        </div>
      </div>
    </div>
  )
})

WhatsAppPreview.displayName = 'WhatsAppPreview'
