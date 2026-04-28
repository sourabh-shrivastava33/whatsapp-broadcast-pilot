import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Save, Eye, AlertCircle, Send, CheckCircle2, XCircle, 
  Image as ImageIcon, Video as VideoIcon, FileText as FileIcon, Type as TextIcon
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { WhatsAppPreview } from '../components/ui/WhatsAppPreview'
import { Chip } from '../components/ui/Chip'
import { MediaPickerModal } from '../components/ui/MediaPickerModal'
import { useTemplates } from '../store/TemplatesContext'
import './TemplateBuilder.css'

/* ... rest of constants ... */

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
      buttons: p.buttons.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)),
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
      buttons: form.buttons.filter((b) => b.text.trim()),
      variables: variables.map((n) => ({ num: n, sample: samples[n] || '' })),
    }
    if (isEdit && existing) {
      updateTemplate({ id: existing.id, ...payload })
      return existing.id
    } else {
      addTemplate(payload)
      // Since addTemplate generates an ID internally and doesn't return it,
      // a robust app would return it. For this demo flow, returning the
      // predictable deterministic logic or updating status on list view works.
      // We will actually just update the last added item since this is sync.
      const idStr = form.name.trim() // Actually addTemplate uses nanoid. 
      // To fix this without refactoring context, we'll just navigate back, 
      // where the user can submit it. Wait, the req says "submit changes status".
      // Let's refactor the save to use a generic approach.
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
      buttons: form.buttons.filter((b) => b.text.trim()),
      variables: variables.map((n) => ({ num: n, sample: samples[n] || '' })),
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
    <Chip label={existing.status.charAt(0).toUpperCase() + existing.status.slice(1)} status={existing.status} />
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
              <span className="builder-locked-text">This template is approved and locked.</span>
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
              <textarea
                id="tpl-body"
                rows={5}
                placeholder={'Hi {{1}}, your order {{2}} has been confirmed!\n\nThank you for shopping with us.'}
                value={form.body}
                onChange={set('body')}
                className={errors.body ? 'error' : ''}
                disabled={isReadOnly}
              />
              <div className="form-hint">
                {form.body.length}/1024 · Use {'{{'} 1 {'}}'}, {'{{'} 2 {'}}'} etc. for variables
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
                placeholder="e.g. Reply STOP to unsubscribe"
                maxLength={60}
                value={form.footer}
                onChange={set('footer')}
                disabled={isReadOnly}
              />
              <div className="form-hint">{form.footer.length}/60</div>
            </div>
          </div>

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
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">URL</option>
                      <option value="PHONE_NUMBER">Phone</option>
                    </select>
                    <input
                      type="text"
                      className="builder-button-text"
                      placeholder="Button label"
                      value={btn.text}
                      onChange={(e) => updateButton(i, 'text', e.target.value)}
                      disabled={isReadOnly}
                    />
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
          <div className="builder-preview-header">
            <Eye size={15} />
            Live Preview
          </div>
          <WhatsAppPreview
            header={form.header}
            headerType={form.headerType}
            mediaUrl={form.mediaUrl}
            body={form.body}
            footer={form.footer}
            buttons={form.buttons}
            sampleValues={samples}
          />
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
