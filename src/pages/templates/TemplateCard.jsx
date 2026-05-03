import React, { memo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Chip } from '../../components/ui/Chip'

const CATEGORY_LABELS = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
}

export const TemplateCard = memo(({ template, onEdit, onDelete }) => (
  <div
    className="template-card"
    onClick={() => onEdit(template.id)}
    onKeyDown={(e) => e.key === 'Enter' && onEdit(template.id)}
    tabIndex={0}
    role="button"
    aria-label={`Edit ${template.name}`}
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
        label={(template.status || 'draft').charAt(0).toUpperCase() + (template.status || 'draft').slice(1)}
        status={template.status || 'draft'}
      />
      <div className="template-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="contact-action-btn"
          onClick={() => onEdit(template.id)}
          title="Edit"
          aria-label="Edit template"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          className="contact-action-btn danger"
          onClick={() => onDelete(template)}
          title="Delete"
          aria-label="Delete template"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
))

TemplateCard.displayName = 'TemplateCard'
