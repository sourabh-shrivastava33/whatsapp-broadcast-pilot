import React, { useState } from 'react'
import { X, Search, Building2, Smartphone, CheckCircle, AlertCircle, Loader2, RefreshCw, Import } from 'lucide-react'
import { Button } from './Button'
import { useAccounts } from '../../store/AccountsContext'
import './MetaDiscoveryModal.css'

const QUALITY_COLORS = {
  GREEN: 'quality-green',
  YELLOW: 'quality-yellow',
  RED: 'quality-red',
  UNKNOWN: 'quality-unknown',
}

export function MetaDiscoveryModal({ isOpen, onClose }) {
  const { addAccount } = useAccounts()
  const [step, setStep] = useState(1) // 1 = credentials, 2 = results
  const [businessId, setBusinessId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [discovered, setDiscovered] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState([])

  if (!isOpen) return null

  const handleDiscover = async () => {
    if (!businessId.trim() || !accessToken.trim()) {
      setError('Both Business Manager ID and Access Token are required.')
      return
    }
    setLoading(true)
    setError(null)
    setDiscovered([])
    setSelected(new Set())
    try {
      const res = await fetch('http://localhost:3001/api/meta/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: businessId.trim(), accessToken: accessToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Discovery failed')
      setDiscovered(data.numbers || [])
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (phoneNumberId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(phoneNumberId) ? next.delete(phoneNumberId) : next.add(phoneNumberId)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(discovered.map((n) => n.phoneNumberId)))
  }

  const clearAll = () => setSelected(new Set())

  const handleImport = async () => {
    const toImport = discovered.filter((n) => selected.has(n.phoneNumberId))
    setImporting(true)
    const results = []
    for (const number of toImport) {
      try {
        const res = await fetch('http://localhost:3001/api/meta/sync-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(number),
        })
        const data = await res.json()
        if (res.ok) {
          addAccount(data)
          results.push({ ok: true, name: number.verifiedName || number.displayPhoneNumber })
        } else {
          results.push({ ok: false, name: number.verifiedName || number.displayPhoneNumber, error: data.error })
        }
      } catch (err) {
        results.push({ ok: false, name: number.displayPhoneNumber, error: err.message })
      }
    }
    setImportSuccess(results)
    setImporting(false)
    setSelected(new Set())
  }

  const handleClose = () => {
    setStep(1)
    setBusinessId('')
    setAccessToken('')
    setError(null)
    setDiscovered([])
    setSelected(new Set())
    setImportSuccess([])
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal meta-discovery-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-header-icon">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="modal-title">Import from Meta Business Manager</h2>
              <p className="modal-subtitle">
                {step === 1 ? 'Connect your Business Manager to discover all WhatsApp numbers.' : `Found ${discovered.length} phone number${discovered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={handleClose}><X size={18} /></button>
        </div>

        {/* Step 1: Credentials */}
        {step === 1 && (
          <div className="modal-body">
            <div className="discovery-form">
              <div className="form-group">
                <label className="form-label">Business Manager ID</label>
                <input
                  id="meta-business-id"
                  className="form-input"
                  type="text"
                  placeholder="e.g. 123456789012345"
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                />
                <span className="form-hint">Found in Meta Business Settings → Business Info</span>
              </div>
              <div className="form-group">
                <label className="form-label">System User Access Token</label>
                <textarea
                  id="meta-access-token"
                  className="form-input form-textarea"
                  placeholder="Paste your System User Access Token here..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  rows={4}
                />
                <span className="form-hint">Requires <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> permissions</span>
              </div>

              {error && (
                <div className="discovery-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button variant="primary" icon={loading ? Loader2 : Search} onClick={handleDiscover} disabled={loading}>
                {loading ? 'Discovering...' : 'Discover Numbers'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Results */}
        {step === 2 && (
          <div className="modal-body">
            {/* Import success feedback */}
            {importSuccess.length > 0 && (
              <div className="import-results">
                {importSuccess.map((r, i) => (
                  <div key={i} className={`import-result-row ${r.ok ? 'success' : 'fail'}`}>
                    {r.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    <span>{r.name} — {r.ok ? 'Imported successfully' : r.error}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="discovery-toolbar">
              <button className="btn-text" onClick={selectAll}>Select All</button>
              <span className="toolbar-sep">·</span>
              <button className="btn-text" onClick={clearAll}>Clear</button>
              <span className="toolbar-count">{selected.size} selected</span>
              <button className="btn-text" onClick={() => setStep(1)}>
                <RefreshCw size={13} /> Re-discover
              </button>
            </div>

            <div className="discovery-list">
              {discovered.length === 0 ? (
                <div className="discovery-empty">No phone numbers found in this Business Manager.</div>
              ) : discovered.map((num) => (
                <div
                  key={num.phoneNumberId}
                  className={`discovery-card ${selected.has(num.phoneNumberId) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(num.phoneNumberId)}
                >
                  <div className="discovery-card-check">
                    <div className={`disc-checkbox ${selected.has(num.phoneNumberId) ? 'checked' : ''}`}>
                      {selected.has(num.phoneNumberId) && <CheckCircle size={14} />}
                    </div>
                  </div>
                  <div className="discovery-card-icon">
                    <Smartphone size={18} />
                  </div>
                  <div className="discovery-card-info">
                    <strong>{num.verifiedName || '—'}</strong>
                    <span>{num.displayPhoneNumber}</span>
                    <span className="discovery-waba">WABA: {num.wabaName || num.wabaId}</span>
                  </div>
                  <div className="discovery-card-badges">
                    <span className={`quality-badge ${QUALITY_COLORS[num.qualityRating] || 'quality-unknown'}`}>
                      {num.qualityRating || 'UNKNOWN'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <Button variant="ghost" onClick={handleClose}>Close</Button>
              <Button
                variant="primary"
                icon={importing ? Loader2 : Import}
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
              >
                {importing ? 'Importing...' : `Import ${selected.size} Number${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
