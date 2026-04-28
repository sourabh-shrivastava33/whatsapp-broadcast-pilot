import React from 'react'
import './WhatsAppPreview.css'

/**
 * WhatsAppPreview — renders a realistic WhatsApp phone bubble
 * with header, body (variables replaced), footer, and buttons.
 *
 * Props: { header, body, footer, buttons[], sampleValues{} }
 */

function replaceSamples(text, samples) {
  if (!text) return ''
  return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
    return samples[num] ? `[${samples[num]}]` : match
  })
}

export function WhatsAppPreview({ 
  header, 
  body, 
  footer, 
  buttons = [], 
  sampleValues = {},
  headerType = 'TEXT',
  mediaUrl = ''
}) {
  const previewBody = replaceSamples(body, sampleValues)
  const previewHeader = replaceSamples(header, sampleValues)

  const hasContent = header || body || footer || buttons.length > 0 || mediaUrl

  return (
    <div className="wa-preview-shell">
      <div className="wa-preview-phone">
        {/* Status bar */}
        <div className="wa-phone-bar">
          <div className="wa-phone-bar-left">
            <div className="wa-phone-back">‹</div>
            <div className="wa-phone-avatar" />
            <div className="wa-phone-name">Business Name</div>
          </div>
          <div className="wa-phone-icons">
            <span>📞</span>
          </div>
        </div>

        {/* Chat area */}
        <div className="wa-phone-chat">
          <div className="wa-chat-date">Today</div>

          {hasContent ? (
            <div className="wa-bubble">
              {headerType !== 'TEXT' ? (
                <div className="wa-bubble-header-media">
                  {headerType === 'IMAGE' && mediaUrl ? (
                    <img src={mediaUrl} alt="Header" className="wa-header-img" />
                  ) : (
                    <div className="wa-header-placeholder">
                      <span className="wa-header-icon">
                        {headerType === 'IMAGE' ? '🖼️' : headerType === 'VIDEO' ? '🎥' : '📄'}
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
                  {previewBody.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < previewBody.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
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
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' '}<span className="wa-bubble-tick">✓✓</span>
              </div>

              {buttons.length > 0 && (
                <div className="wa-bubble-buttons">
                  {buttons.map((btn, i) => (
                    <button key={i} className="wa-bubble-btn">
                      {btn.text || 'Button'}
                    </button>
                  ))}
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
}
