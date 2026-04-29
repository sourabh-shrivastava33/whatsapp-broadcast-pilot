import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, MessageSquare, Send, Search, Filter, 
  Smartphone, Layout, CheckCircle, AlertCircle,
  Zap, Calendar, Clock, BarChart3, Info, HelpCircle,
  Radio, FileText, AlertTriangle, ExternalLink
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { useBroadcasts } from '../store/BroadcastsContext'
import { useAccounts } from '../store/AccountsContext'
import { useTemplates } from '../store/TemplatesContext'
import { useContacts } from '../store/ContactsContext'
import './Broadcast.css'

const steps = [
  { id: 1, label: 'Select Account', icon: Smartphone },
  { id: 2, label: 'Choose Template', icon: FileText },
  { id: 3, label: 'Select Contacts', icon: Users },
  { id: 4, label: 'Send Broadcast', icon: Send },
]

export default function Broadcast() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [sendingState, setSendingState] = useState('idle') // idle | sending | success

  const { broadcasts, addBroadcast } = useBroadcasts()
  const { accounts } = useAccounts()
  const { templates } = useTemplates()
  const { contacts } = useContacts()

  const [draft, setDraft] = useState({
    accountId: null,
    templateId: null,
    contactIds: []
  })

  const approvedTemplates = templates.filter(t => t.status === 'approved')

  const resetWizard = () => {
    setShowModal(false)
    setCurrentStep(1)
    setSendingState('idle')
    setDraft({ accountId: null, templateId: null, contactIds: [] })
  }

  const handleNext = () => setCurrentStep(prev => prev + 1)
  const handleBack = () => setCurrentStep(prev => prev - 1)

  const handleSend = async () => {
    setSendingState('sending')
    try {
      await addBroadcast({
        accountId: draft.accountId,
        templateId: draft.templateId,
        contactIds: draft.contactIds,
      })
      setSendingState('success')
    } catch (error) {
      console.error('Broadcast failed:', error)
      setSendingState('idle')
      alert('Failed to initiate broadcast. Please check server logs.')
    }
  }

  const renderStep1 = () => (
    <div className="wizard-step">
      <div className="wizard-step-header">
        <h3>Select WhatsApp Account</h3>
      </div>
      {accounts.length === 0 ? (
        <p className="wizard-empty">No accounts connected. Please connect an account first.</p>
      ) : (
        <div className="wizard-selection-list">
          {accounts.map(acc => (
            <div 
              key={acc.id} 
              className={`wizard-card ${draft.accountId === acc.id ? 'selected' : ''}`}
              onClick={() => setDraft({ ...draft, accountId: acc.id })}
            >
              <Smartphone size={20} className="wizard-card-icon" />
              <div className="wizard-card-info">
                <strong>{acc.displayName}</strong>
                <span>{acc.businessLabel || 'Standard Account'}</span>
              </div>
              <div className="wizard-card-radio">
                {draft.accountId === acc.id && <div className="radio-inner" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="wizard-step">
      <div className="wizard-step-header">
        <h3>Choose Approved Template</h3>
      </div>
      {approvedTemplates.length === 0 ? (
        <p className="wizard-empty">No approved templates available. Please create and approve a template.</p>
      ) : (
        <div className="wizard-selection-list">
          {approvedTemplates.map(tpl => (
            <div 
              key={tpl.id} 
              className={`wizard-card ${draft.templateId === tpl.id ? 'selected' : ''}`}
              onClick={() => setDraft({ ...draft, templateId: tpl.id })}
            >
              <FileText size={20} className="wizard-card-icon" />
              <div className="wizard-card-info">
                <strong>{tpl.name}</strong>
                <span>{tpl.category}</span>
              </div>
              <div className="wizard-card-radio">
                {draft.templateId === tpl.id && <div className="radio-inner" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderStep3 = () => {
    const toggleContact = (id) => {
      const selected = draft.contactIds.includes(id)
      setDraft({
        ...draft,
        contactIds: selected 
          ? draft.contactIds.filter(cId => cId !== id)
          : [...draft.contactIds, id]
      })
    }
    const selectAll = () => setDraft({ ...draft, contactIds: contacts.map(c => c.id) })
    const deselectAll = () => setDraft({ ...draft, contactIds: [] })

    return (
      <div className="wizard-step">
        <div className="wizard-step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Select Contacts</h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Button variant="ghost" onClick={selectAll}>Select All</Button>
            <Button variant="ghost" onClick={deselectAll}>None</Button>
          </div>
        </div>
        {contacts.length === 0 ? (
          <p className="wizard-empty">No contacts available.</p>
        ) : (
          <div className="wizard-selection-list">
            {contacts.map(c => (
              <div 
                key={c.id} 
                className={`wizard-card ${draft.contactIds.includes(c.id) ? 'selected' : ''}`}
                onClick={() => toggleContact(c.id)}
              >
                <Users size={20} className="wizard-card-icon" />
                <div className="wizard-card-info">
                  <strong>{c.name}</strong>
                  <span>{c.phone}</span>
                </div>
                <div className={`wizard-card-checkbox ${draft.contactIds.includes(c.id) ? 'checked' : ''}`}>
                  {draft.contactIds.includes(c.id) && <CheckCircle size={14} strokeWidth={3} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderStep4 = () => {
    const selectedAccount = accounts.find(a => a.id === draft.accountId)
    const selectedTemplate = templates.find(t => t.id === draft.templateId)

    if (sendingState === 'success') {
      return (
        <div className="wizard-step wizard-success fade-in">
          <div className="success-icon-wrapper">
            <CheckCircle size={48} className="success-icon" />
          </div>
          <h3>Broadcast Sent!</h3>
          <p>Your message has been queued for {draft.contactIds.length} recipients.</p>
        </div>
      )
    }

    return (
      <div className="wizard-step">
        <div className="wizard-step-header">
          <h3>Review Broadcast</h3>
        </div>
        <div className="wizard-summary">
          <div className="summary-row">
            <span>Account</span>
            <strong>{selectedAccount?.displayName}</strong>
          </div>
          <div className="summary-row">
            <span>Template</span>
            <strong>{selectedTemplate?.name}</strong>
          </div>
          <div className="summary-row">
            <span>Recipients</span>
            <strong>{draft.contactIds.length} contacts</strong>
          </div>
        </div>
        {sendingState === 'sending' && (
          <div className="wizard-sending fade-in">
            <div className="wizard-spinner" />
            <p>Sending broadcast...</p>
          </div>
        )}
      </div>
    )
  }

  const renderModalFooter = () => {
    if (sendingState === 'success') {
      return (
        <div className="wizard-footer-right">
          <Button variant="primary" onClick={resetWizard}>Done</Button>
        </div>
      )
    }
    if (sendingState === 'sending') {
      return <div className="wizard-footer-right"></div>
    }

    const canGoNext = 
      (currentStep === 1 && draft.accountId) ||
      (currentStep === 2 && draft.templateId) ||
      (currentStep === 3 && draft.contactIds.length > 0)
    
    return (
      <div className="wizard-footer">
        <div className="wizard-footer-left">
          {currentStep > 1 && currentStep < 4 && (
            <Button variant="ghost" onClick={handleBack}>Back</Button>
          )}
        </div>
        <div className="wizard-footer-right">
          <Button variant="ghost" onClick={resetWizard}>Cancel</Button>
          {currentStep < 4 ? (
            <Button variant="primary" onClick={handleNext} disabled={!canGoNext}>Next</Button>
          ) : (
            <Button variant="primary" icon={Send} onClick={handleSend}>Send Broadcast</Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Broadcast</h1>
          <p className="page-subtitle">
            {broadcasts.length > 0
              ? `${broadcasts.length} broadcast${broadcasts.length > 1 ? 's' : ''} sent`
              : 'Send WhatsApp messages to your contacts at scale'}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={Zap} onClick={() => setShowModal(true)}>
            New Broadcast
          </Button>
        </div>
      </div>

      <div className="info-hint mb-6">
        <Info size={16} className="info-hint-icon" />
        <p>
          Broadcasts use Meta-approved templates. Ensure your contacts have opted-in to receive 
          messages to maintain your account quality rating. 
          <a href="#" className="info-link" title="Learn more about Meta's broadcast policies"> Learn more</a>
        </p>
      </div>

      <div className="broadcast-stepper">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className={`broadcast-step ${idx === 0 ? 'active' : ''}`}>
              <span className="broadcast-step-number">{step.id}</span>
              <step.icon size={16} />
              {step.label}
            </div>
            {idx < steps.length - 1 && <div className="broadcast-step-connector" />}
          </React.Fragment>
        ))}
      </div>

      {broadcasts.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No broadcasts sent yet"
          description="Create a broadcast to send approved templates to your selected contacts through your connected WhatsApp account."
          actionLabel="New Broadcast"
          actionIcon={Zap}
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="broadcasts-list">
          {broadcasts.map((broadcast) => (
            <div 
              key={broadcast.id} 
              className="broadcast-row clickable"
              onClick={() => navigate(`/broadcast/${broadcast.id}`)}
            >
              <div className="broadcast-row-icon">
                <Radio size={18} />
              </div>
              <div className="broadcast-row-info">
                <div className="broadcast-row-title">
                  Broadcast · {broadcast.contactIds.length} recipient{broadcast.contactIds.length !== 1 ? 's' : ''}
                </div>
                <div className="broadcast-row-date">
                  {new Date(broadcast.sentAt).toLocaleString()}
                </div>
              </div>
              <div className="broadcast-row-status-group">
                <span className={`chip chip-${broadcast.status}`}>
                  <span className="chip-dot" />
                  {broadcast.status.charAt(0).toUpperCase() + broadcast.status.slice(1)}
                </span>
                <ExternalLink size={14} className="row-hover-icon" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={resetWizard}
        title={sendingState === 'success' ? '' : steps[currentStep - 1].label}
        footer={renderModalFooter()}
      >
        <div className="broadcast-wizard">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </Modal>
    </div>
  )
}

