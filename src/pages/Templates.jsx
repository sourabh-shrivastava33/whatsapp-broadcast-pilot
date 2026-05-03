import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import FilePlus from 'lucide-react/dist/esm/icons/file-plus'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import { Button } from '../components/ui/Button'
import { FilterChip } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { useTemplates } from '../store/TemplatesContext'
import { useToast } from '../store/ToastContext'
import { TemplateCard } from './templates/TemplateCard'
import { TemplatesSkeleton } from './templates/TemplatesSkeleton'
import './Templates.css'

const STATUS_FILTERS = ['All', 'Draft', 'Pending', 'Approved', 'Rejected']

export default function Templates() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('All')
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const { templates, loading, deleteTemplate, syncTemplates } = useTemplates()
  const { toast } = useToast()

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await syncTemplates()
    } catch (err) {
      console.error(err)
      toast({ type: 'error', title: 'Sync Failed', message: err.message })
    } finally {
      setSyncing(false)
    }
  }, [syncTemplates, toast])

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return templates
    return templates.filter((t) => (t.status || '').toLowerCase() === activeFilter.toLowerCase())
  }, [templates, activeFilter])

  const counts = useMemo(() => {
    const c = { All: templates.length, Draft: 0, Pending: 0, Approved: 0, Rejected: 0 }
    templates.forEach(t => {
      const s = (t.status || 'draft').toLowerCase()
      const key = s.charAt(0).toUpperCase() + s.slice(1)
      if (c[key] !== undefined) c[key]++
    })
    return c
  }, [templates])

  const handleDelete = useCallback(() => {
    if (deletingTemplate) {
      deleteTemplate(deletingTemplate.id)
      setDeletingTemplate(null)
      toast({ type: 'success', title: 'Deleted', message: 'Template removed successfully' })
    }
  }, [deletingTemplate, deleteTemplate, toast])

  const handleEdit = useCallback((id) => {
    navigate(`/templates/${id}/edit`)
  }, [navigate])

  const setDeleting = useCallback((template) => {
    setDeletingTemplate(template)
  }, [])

  if (loading) {
    return <TemplatesSkeleton />
  }

  return (
    <div className="page fade-in templates-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">
            {templates.length > 0
              ? `${templates.length} template${templates.length !== 1 ? 's' : ''} available`
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
            aria-label="Sync with Meta"
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
          title={`No ${(activeFilter || 'all').toLowerCase()} templates`}
          description={`You don't have any templates with "${activeFilter || 'all'}" status.`}
        />
      ) : (
        <div className="templates-list">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={setDeleting}
            />
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
