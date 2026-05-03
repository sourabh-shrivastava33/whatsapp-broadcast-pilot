import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Save, Eye, AlertCircle, Send, CheckCircle2, XCircle, 
  Image as ImageIcon, Video as VideoIcon, FileText as FileIcon, Type as TextIcon,
  Info, HelpCircle, Tag, Globe, MessageSquare, ShieldCheck
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { WhatsAppPreview } from '../components/ui/WhatsAppPreview'
import { Chip } from '../components/ui/Chip'
import { MediaPickerModal } from '../components/ui/MediaPickerModal'
import { useTemplates } from '../store/TemplatesContext'
import './TemplateBuilder.css'

const AUTH_BODY = '{{1}} is your verification code. For your security, do not share this code.'
const AUTH_FOOTER = 'For your security, do not share this code.'

/* ── constants ── */
const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt_BR', label: 'Portuguese (BR)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
]

/* ── helpers ── */
function detectVariables(text) {
  if (!text) return []
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)]
  const nums = [...new Set(matches.map((m) => m[1]))]
  return nums.sort((a, b) => Number(a) - Number(b))
}

/* ── component ── */
export default function TemplateBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { templates, addTemplate, updateTemplate, setTemplateStatus, submitTemplateForApproval } = useTemplates()

  const isEdit = !!id
  const existing = useMemo(() => templates.find((t) => t.id === id), [templates, id])
  const status = existing?.status || 'draft'
  const isReadOnly = status === 'pending' || status === 'approved'

  /* form state */
  const [form, setForm] = useState({
    name: '',
    category: 'MARKETING',
    useCaseLabel: '',
    language: 'en_US',
    headerType: 'TEXT',
    header: '',
    mediaUrl: '',
    body: '',
    footer: '',
    buttons: [],
    limitedTimeOffer: null, // { text: 'Flash Sale!', has_expiration: true }
  })
  const [samples, setSamples] = useState({})
  const [errors, setErrors] = useState({})
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false)

  /* populate when editing */
  useEffect(() => {
    if (isEdit && existing) {
      setForm({
        name: existing.name || '',
        category: existing.category || 'MARKETING',
        useCaseLabel: existing.useCaseLabel || '',
        language: existing.language || 'en_US',
        headerType: existing.headerType || 'TEXT',
        header: existing.header || '',
        mediaUrl: existing.mediaUrl || '',
        body: existing.body || '',
        footer: existing.footer || '',
        buttons: existing.buttons || [],
        limitedTimeOffer: existing.limitedTimeOffer || null,
      })
      // restore sample values
      const sv = {}
      ;(existing.variables || []).forEach((v) => { sv[v.num] = v.sample })
      setSamples(sv)
    }
  }, [isEdit, existing])

  /* detect variables in body (and header) */
  const variables = useMemo(() => {
    const fromBody = detectVariables(form.body)
    const fromHeader = detectVariables(form.header)
    const all = [...new Set([...fromHeader, ...fromBody])]
    return all.sort((a, b) => Number(a) - Number(b))
  }, [form.body, form.header])

  /* helpers */
  const set = useCallback((field) => (e) =>
    setForm((p) => ({ ...p, [field]: e.target.value })), [])

  const addButton = () => {
    if (isReadOnly || form.buttons.length >= 3) return
    setForm((p) => ({ ...p, buttons: [...p.buttons, { type: 'QUICK_REPLY', text: '' }] }))
  }

  const removeButton = (i) => {
    if (isReadOnly) return
    setForm((p) => ({ ...p, buttons: p.buttons.filter((_, idx) => idx !== i) }))
  }

  const updateButton = (i, field, value) => {
    if (isReadOnly) return
    setForm((p) => ({
      ...p,
      buttons: p.buttons.map((b, idx) => {
        if (idx === i) {
          const newBtn = { ...b, [field]: value };
          // Default values for specialized types
          if (field === 'type') {
            if (value === 'OTP') {
              newBtn.otp_type = 'COPY_CODE';
              newBtn.text = 'Copy Code';
            } else if (value === 'CATALOG') {
              newBtn.text = 'View Catalog';
            } else if (value === 'OPT_OUT') {
              newBtn.type = 'QUICK_REPLY';
              newBtn.text = 'Stop promotions';
              newBtn.isOptOut = true;
            } else if (value === 'COPY_CODE') {
              newBtn.text = 'Copy Code';
              newBtn.example = 'SAVE20';
            }
          }
          return newBtn;
        }
        return b;
      }),
    }))
  }

  /* validation */
  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Template name is required'
    else if (!/^[a-z0-9_]+$/.test(form.name.trim()))
      e.name = 'Name must be lowercase letters, numbers, or underscores only'
    if (!form.body.trim()) e.body = 'Message body is required'
    variables.forEach((n) => {
      if (!samples[n]?.trim()) e[`sample_${n}`] = `Sample value for {{${n}}} is required`
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveDraft = () => {
    if (!validate()) return
    savePayload()
    navigate('/templates')
  }

  const handleSubmitApproval = () => {
    if (!validate()) return
    const newId = savePayload()
    setTemplateStatus(newId, 'pending')
    navigate('/templates')
  }

  const savePayload = () => {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      useCaseLabel: form.useCaseLabel.trim(),
      language: form.language,
      headerType: form.headerType,
      header: form.header.trim(),
      mediaUrl: form.mediaUrl,
      body: form.body.trim(),
      footer: form.footer.trim(),
      buttons: form.buttons.filter((b) => (b.text && b.text.trim()) || b.type === 'COPY_CODE'),
      variables: variables.map((n) => ({ num: n, sample: samples[n] || '' })),
      limitedTimeOffer: form.limitedTimeOffer,
    }
    if (isEdit && existing) {
      updateTemplate({ id: existing.id, ...payload })
      return existing.id
    } else {
      addTemplate(payload)
    }
  }

  /* Re-writing handleSave to properly extract id */
  const doSave = (targetStatus) => {
    if (!validate()) return
    const payload = {
      name: form.name.trim(),
      category: form.category,
      useCaseLabel: form.useCaseLabel.trim(),
      language: form.language,
      headerType: form.headerType,
      header: form.header.trim(),
      mediaUrl: form.mediaUrl,
      body: form.body.trim(),
      footer: form.footer.trim(),
      buttons: form.buttons.filter((b) => (b.text && b.text.trim()) || b.type === 'COPY_CODE'),
      variables: variables.map((n) => ({ num: n, sample: samples[n] || '' })),
      limitedTimeOffer: form.limitedTimeOffer,
    }

    if (isEdit && existing) {
      updateTemplate({ id: existing.id, ...payload })
      if (targetStatus === 'pending') {
        submitTemplateForApproval(existing.id)
          .then(() => navigate('/templates'))
          .catch(err => alert('Failed to submit template: ' + err.message))
        return
      } else if (targetStatus && targetStatus !== existing.status) {
        setTemplateStatus(existing.id, targetStatus)
      }
    } else {
      // For new templates, we save then submit if needed
      addTemplate({ ...payload, status: 'draft' })
        .then(async (newTpl) => {
           if (targetStatus === 'pending') {
             try {
               await submitTemplateForApproval(newTpl.id)
               navigate('/templates')
             } catch (err) {
               alert('Template saved as draft, but Meta submission failed: ' + err.message)
               navigate('/templates')
             }
           } else {
             navigate('/templates')
           }
        })
    }
    if (targetStatus !== 'pending') {
      navigate('/templates')
    }
  }

  const handleDemoAction = (newStatus) => {
    setTemplateStatus(existing.id, newStatus)
  }

  /* status chip for edit mode */
  const statusChip = isEdit && existing ? (
    <Chip label={(existing.status || 'draft').charAt(0).toUpperCase() + (existing.status || 'draft').slice(1)} status={existing.status || 'draft'} />
  ) : null

  return (
    <div className="template-builder fade-in">
      {/* Top bar */}
      <div className="builder-topbar">
        <button className="builder-back" onClick={() => navigate('/templates')}>
          <ArrowLeft size={16} />
          Templates
        </button>
        <div className="builder-topbar-center">
          <h1 className="builder-title">
            {isEdit ? 'Edit Template' : 'New Template'}
          </h1>
          {statusChip}
        </div>
        
        {/* Actions based on status */}
        <div className="builder-topbar-actions">
          {isReadOnly ? (
            status === 'pending' ? (
              <>
                <Button variant="ghost" icon={XCircle} onClick={() => handleDemoAction('rejected')} className="demo-btn-reject">
                  Reject (Demo)
                </Button>
                <Button variant="primary" icon={CheckCircle2} onClick={() => handleDemoAction('approved')} className="demo-btn-approve">
                  Approve (Demo)
                </Button>
              </>
            ) : (
              <div className="status-badge-premium approved">
                <ShieldCheck size={14} />
                <span>Approved & Protected</span>
              </div>
            )
          ) : (
            <>
              <Button variant="ghost" icon={Save} onClick={() => doSave('draft')}>
                Save Draft
              </Button>
              <Button variant="primary" icon={Send} onClick={() => doSave('pending')}>
                Submit for Approval
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Split layout */}
      <div className="builder-split">
        {/* ── LEFT: Form ── */}
        <div className="builder-form-panel">
          <div className="builder-section">
            <h2 className="builder-section-title">Template Info</h2>

            {/* Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="tpl-name">Template Name</label>
              <input
                id="tpl-name"
                type="text"
                placeholder="e.g. welcome_message"
                value={form.name}
                onChange={set('name')}
                className={errors.name ? 'error' : ''}
                disabled={isReadOnly}
              />
              <div className="form-hint">Lowercase, underscores only. Used as the API identifier.</div>
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            {/* Category + Language row */}
            <div className="builder-row">
              <div className="form-group">
                <label className="form-label" htmlFor="tpl-category">Category</label>
                <select id="tpl-category" value={form.category} onChange={set('category')} disabled={isReadOnly}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="tpl-lang">Language</label>
                <select id="tpl-lang" value={form.language} onChange={set('language')} disabled={isReadOnly}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Use case label */}
            <div className="form-group">
              <label className="form-label" htmlFor="tpl-usecase">
                Use Case Label <span className="form-label-optional">(Optional)</span>
              </label>
              <input
                id="tpl-usecase"
                type="text"
                placeholder="e.g. Order Confirmation, Promo Offer"
                value={form.useCaseLabel}
                onChange={set('useCaseLabel')}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="builder-divider" />

          {/* Message */}
          <div className="builder-section">
            <h2 className="builder-section-title">Message Content</h2>

            {/* Header */}
            <div className="form-group">
              <label className="form-label">Header Type</label>
              <div className="header-type-tabs">
                {[
                  { id: 'TEXT', label: 'Text', icon: TextIcon },
                  { id: 'IMAGE', label: 'Image', icon: ImageIcon },
                  { id: 'VIDEO', label: 'Video', icon: VideoIcon },
                  { id: 'DOCUMENT', label: 'File', icon: FileIcon },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`header-type-tab ${form.headerType === t.id ? 'active' : ''}`}
                    onClick={() => !isReadOnly && setForm(p => ({ ...p, headerType: t.id }))}
                    disabled={isReadOnly}
                  >
                    <t.icon size={14} />
                    {t.label}
                  </button>
                ))}
              </div>

              {form.headerType === 'TEXT' ? (
                <div className="mt-4">
                  <input
                    id="tpl-header"
                    type="text"
                    placeholder="Short header text (max 60 chars)"
                    maxLength={60}
                    value={form.header}
                    onChange={set('header')}
                    disabled={isReadOnly}
                  />
                  <div className="form-hint">{form.header.length}/60 · Supports {"{{1}}"}</div>
                </div>
              ) : (
                <div className="mt-4">
                  {form.mediaUrl ? (
                    <div className="media-preview-box">
                      {form.headerType === 'IMAGE' ? (
                        <img src={form.mediaUrl} alt="Preview" className="media-preview-thumb" />
                      ) : (
                        <div className="media-preview-icon">
                          {form.headerType === 'VIDEO' ? <VideoIcon size={24} /> : <FileIcon size={24} />}
                        </div>
                      )}
                      <div className="media-preview-info">
                        <span className="media-preview-url truncate">{form.mediaUrl}</span>
                        {!isReadOnly && (
                          <button 
                            className="media-change-btn"
                            onClick={() => setIsMediaPickerOpen(true)}
                          >
                            Change
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="media-select-placeholder"
                      onClick={() => setIsMediaPickerOpen(true)}
                      disabled={isReadOnly}
                    >
                      <Plus size={20} />
                      <span>Select {form.headerType.toLowerCase()} from library</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="form-group">
              <label className="form-label" htmlFor="tpl-body">Body *</label>
              {form.category === 'AUTHENTICATION' ? (
                <div className="auth-body-locked">
                  <textarea
                    id="tpl-body"
                    rows={3}
                    value={AUTH_BODY}
                    readOnly
                    className="locked-input"
                  />
                  <div className="auth-notice">
                    <Info size={12} />
                    Authentication templates use a fixed format required by Meta.
                  </div>
                </div>
              ) : (
                <textarea
                  id="tpl-body"
                  rows={5}
                  placeholder={'Hi {{1}}, your order {{2}} has been confirmed!\n\nThank you for shopping with us.'}
                  value={form.body}
                  onChange={set('body')}
                  className={errors.body ? 'error' : ''}
                  disabled={isReadOnly}
                />
              )}
              <div className="form-hint">
                {form.category === 'AUTHENTICATION' ? 'Fixed' : `${form.body.length}/1024`} · Use {'{{'} 1 {'}}'}, {'{{'} 2 {'}}'} etc. for variables
              </div>
              {errors.body && <span className="form-error">{errors.body}</span>}
            </div>

            {/* Footer */}
            <div className="form-group">
              <label className="form-label" htmlFor="tpl-footer">
                Footer <span className="form-label-optional">(Optional)</span>
              </label>
              <input
                id="tpl-footer"
                type="text"
                placeholder={form.category === 'AUTHENTICATION' ? AUTH_FOOTER : "e.g. Reply STOP to unsubscribe"}
                maxLength={60}
                value={form.category === 'AUTHENTICATION' ? (form.footer || AUTH_FOOTER) : form.footer}
                onChange={set('footer')}
                disabled={isReadOnly || form.category === 'AUTHENTICATION'}
              />
              <div className="form-hint">{form.category === 'AUTHENTICATION' ? 'Required for Authentication' : `${form.footer.length}/60`}</div>
            </div>
          </div>

          {/* Marketing Specialized: Limited Time Offer */}
          {form.category === 'MARKETING' && (
            <div className="builder-section">
              <div className="builder-section-header">
                <h2 className="builder-section-title">
                  Limited-Time Offer
                  <span className="builder-section-badge">New</span>
                </h2>
                <div className="toggle-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="lto-toggle" 
                    checked={!!form.limitedTimeOffer}
                    onChange={(e) => setForm(p => ({ 
                      ...p, 
                      limitedTimeOffer: e.target.checked ? { text: 'Flash Sale!', has_expiration: true } : null 
                    }))}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="lto-toggle" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enable Banner</label>
                </div>
              </div>
              {form.limitedTimeOffer && (
                <div className="lto-config fade-in" style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Banner Text</label>
                    <input 
                      type="text" 
                      value={form.limitedTimeOffer.text} 
                      onChange={(e) => setForm(p => ({ 
                        ...p, 
                        limitedTimeOffer: { ...p.limitedTimeOffer, text: e.target.value } 
                      }))}
                      placeholder="e.g. Flash Sale!"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="builder-divider" />

          {/* Variables */}
          {variables.length > 0 && (
            <>
              <div className="builder-section">
                <h2 className="builder-section-title">
                  Sample Variable Values
                  <span className="builder-section-badge">{variables.length} detected</span>
                </h2>
                <p className="builder-section-hint">
                  Provide sample values so Meta can review your template. These appear in the preview.
                </p>
                {variables.map((n) => (
                  <div className="form-group" key={n}>
                    <label className="form-label" htmlFor={`sample-${n}`}>
                      {'{{'}{n}{'}}'}
                    </label>
                    <input
                      id={`sample-${n}`}
                      type="text"
                      placeholder={`Sample value for variable ${n}`}
                      value={samples[n] || ''}
                      onChange={(e) => setSamples((p) => ({ ...p, [n]: e.target.value }))}
                      className={errors[`sample_${n}`] ? 'error' : ''}
                      disabled={isReadOnly}
                    />
                    {errors[`sample_${n}`] && (
                      <span className="form-error">{errors[`sample_${n}`]}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="builder-divider" />
            </>
          )}

          {/* Buttons */}
          <div className="builder-section">
            <div className="builder-section-header">
              <h2 className="builder-section-title">Buttons</h2>
              <button
                className="builder-add-btn"
                onClick={addButton}
                disabled={isReadOnly || form.buttons.length >= 3}
              >
                <Plus size={14} /> Add Button
              </button>
            </div>
            <p className="builder-section-hint">
              Optional. Max 3 buttons. Quick Reply or Call-to-Action.
            </p>

            {form.buttons.length === 0 ? (
              <div className="builder-buttons-empty">No buttons added</div>
            ) : (
              <div className="builder-buttons-list">
                {form.buttons.map((btn, i) => (
                  <div key={i} className="builder-button-row">
                    <select
                      className="builder-button-type"
                      value={btn.type}
                      onChange={(e) => updateButton(i, 'type', e.target.value)}
                      disabled={isReadOnly}
                    >
                      {form.category === 'AUTHENTICATION' ? (
                        <option value="OTP">OTP (Copy/One-Tap)</option>
                      ) : (
                        <>
                          <option value="QUICK_REPLY">Quick Reply</option>
                          <option value="URL">URL</option>
                          <option value="PHONE_NUMBER">Phone</option>
                          <option value="CATALOG">Catalog</option>
                          <option value="OPT_OUT">Marketing Opt-out</option>
                          <option value="COPY_CODE">Copy Offer Code</option>
                        </>
                      )}
                    </select>
                    <input
                      type="text"
                      className="builder-button-text"
                      placeholder="Button label"
                      value={btn.text}
                      onChange={(e) => updateButton(i, 'text', e.target.value)}
                      disabled={isReadOnly || btn.type === 'OTP' || btn.type === 'CATALOG'}
                    />
                    
                    {/* Specialized Button Options */}
                    {btn.type === 'OTP' && (
                      <select
                        className="builder-button-subtype"
                        value={btn.otp_type}
                        onChange={(e) => updateButton(i, 'otp_type', e.target.value)}
                        disabled={isReadOnly}
                      >
                        <option value="COPY_CODE">Copy Code</option>
                        <option value="ONE_TAP">One-Tap (Android)</option>
                      </select>
                    )}
                    
                    {btn.otp_type === 'ONE_TAP' && (
                      <div className="otp-details">
                        <input 
                          type="text" 
                          placeholder="Package Name" 
                          value={btn.package_name || ''} 
                          onChange={(e) => updateButton(i, 'package_name', e.target.value)}
                        />
                        <input 
                          type="text" 
                          placeholder="Hash" 
                          value={btn.signature_hash || ''} 
                          onChange={(e) => updateButton(i, 'signature_hash', e.target.value)}
                        />
                      </div>
                    )}

                    {btn.type === 'COPY_CODE' && (
                      <div className="otp-details">
                        <input 
                          type="text" 
                          placeholder="Coupon Code Example" 
                          value={btn.example || ''} 
                          onChange={(e) => updateButton(i, 'example', e.target.value)}
                        />
                      </div>
                    )}
                    <button
                      className="builder-button-remove"
                      onClick={() => removeButton(i)}
                      aria-label="Remove button"
                      disabled={isReadOnly}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error summary */}
          {Object.keys(errors).length > 0 && (
            <div className="builder-error-banner">
              <AlertCircle size={16} />
              Please fix the errors above before saving.
            </div>
          )}
        </div>

        {/* ── RIGHT: Preview ── */}
        <div className="builder-preview-panel">
          <div className="preview-sticky-wrapper">
            <div className="builder-preview-header">
              <Eye size={15} />
              <span>LIVE PREVIEW</span>
              <div className="preview-live-dot" />
            </div>
            <div className={`preview-container-premium ${status === 'approved' ? 'is-approved' : ''}`}>
              <WhatsAppPreview
                header={form.header}
                headerType={form.headerType}
                mediaUrl={form.mediaUrl}
                body={form.body}
                footer={form.footer}
                buttons={form.buttons}
                sampleValues={samples}
                limitedTimeOffer={form.limitedTimeOffer}
              />
              
              {!form.body && !form.header && (
                <div className="preview-empty-ux">
                  <div className="ux-gif-wrapper">
                    <img 
                      src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJ1ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6ZzZ6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1z/3o7TKMGpx4RQC9KkAU/giphy.gif" 
                      alt="Empty"
                    />
                  </div>
                  <p>Start typing to see the magic happen...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MediaPickerModal 
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        type={form.headerType}
        onSelect={(item) => {
          setForm(p => ({ ...p, mediaUrl: item.url }));
          setIsMediaPickerOpen(false);
        }}
      />
    </div>
  )
}
