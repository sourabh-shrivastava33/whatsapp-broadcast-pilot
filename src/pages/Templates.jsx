import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FilePlus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { FilterChip, Chip } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { useTemplates } from '../store/TemplatesContext'
import './Templates.css'

const STATUS_FILTERS = ['All', 'Draft', 'Pending', 'Approved', 'Rejected']

const CATEGORY_LABELS = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
}

export default function Templates() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('All')
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const { templates, deleteTemplate, syncTemplates } = useTemplates()

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncTemplates()
    } catch (err) {
      console.error(err)
      alert('Failed to sync templates: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return templates
    return templates.filter((t) => t.status === activeFilter.toLowerCase())
  }, [templates, activeFilter])

  const counts = useMemo(() => {
    const c = { All: templates.length }
    STATUS_FILTERS.slice(1).forEach((s) => {
      c[s] = templates.filter((t) => t.status === s.toLowerCase()).length
    })
    return c
  }, [templates])

  const handleDelete = () => {
    if (deletingTemplate) {
      deleteTemplate(deletingTemplate.id)
      setDeletingTemplate(null)
    }
  }

  return (
    <div className="page fade-in templates-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">
            {templates.length > 0
              ? `${templates.length} template${templates.length !== 1 ? 's' : ''}`
              : 'Create and manage your WhatsApp message templates'}
          </p>
        </div>
        <div className="page-actions">
          <Button 
            variant="ghost" 
            icon={RefreshCw} 
            onClick={handleSync}
            disabled={syncing}
            className={syncing ? 'spin' : ''}
          >
            {syncing ? 'Syncing...' : 'Sync with Meta'}
          </Button>
          <Button variant="primary" icon={FilePlus} onClick={() => navigate('/templates/new')}>
            Create Template
          </Button>
        </div>
      </div>

      {/* Filter chips with live counts */}
      <div className="filter-bar">
        {STATUS_FILTERS.map((filter) => (
          <FilterChip
            key={filter}
            label={`${filter}${counts[filter] > 0 ? ` (${counts[filter]})` : ''}`}
            active={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
          />
        ))}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates created yet"
          description="Create a WhatsApp message template to start broadcasting. Templates need approval before they can be used."
          actionLabel="Create Template"
          actionIcon={FilePlus}
          onAction={() => navigate('/templates/new')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${activeFilter.toLowerCase()} templates`}
          description={`You don't have any templates with "${activeFilter}" status.`}
        />
      ) : (
        <div className="templates-list">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="template-card"
              onClick={() => navigate(`/templates/${template.id}/edit`)}
            >
              <div className="template-card-left">
                <div className="template-card-name">{template.name}</div>
                <div className="template-card-meta">
                  {CATEGORY_LABELS[template.category] || template.category}
                  {template.useCaseLabel ? ` · ${template.useCaseLabel}` : ''}
                  {' · '}
                  {template.language}
                </div>
                {template.status === 'rejected' && template.rejectionReason && (
                  <div className="template-rejection-reason">
                    Reason: {template.rejectionReason}
                  </div>
                )}
              </div>
              <div className="template-card-right">
                <Chip
                  label={template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                  status={template.status}
                />
                <div className="template-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="contact-action-btn"
                    onClick={() => navigate(`/templates/${template.id}/edit`)}
                    title="Edit"
                    aria-label="Edit template"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="contact-action-btn danger"
                    onClick={() => setDeletingTemplate(template)}
                    title="Delete"
                    aria-label="Delete template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        title="Delete Template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingTemplate(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{deletingTemplate?.name}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
