import React, { useState, useMemo, useRef } from 'react'
import {
  ShieldCheck, ShieldAlert, Upload, Download, Search,
  Filter, Ban, CheckCircle, AlertTriangle, AlertCircle, Info, Lock
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useContacts } from '../store/ContactsContext'
import { useToast } from '../store/ToastContext'
import './Compliance.css'

export default function Compliance() {
  const { contacts, blockContact, unblockContact } = useContacts()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all') // all, opted_in, opted_out, blocklisted
  const fileInputRef = useRef(null)
  const [isImporting, setIsImporting] = useState(false)
  const [blockConfirmId, setBlockConfirmId] = useState(null)

  // Derive stats
  const stats = useMemo(() => {
    let inCount = 0; let outCount = 0; let blockCount = 0;
    contacts.forEach(c => {
      if (c.optInStatus === 'opted_in') inCount++
      if (c.optInStatus === 'opted_out') outCount++
      if (c.isBlocklisted) blockCount++
    })
    return {
      total: contacts.length,
      optedIn: inCount,
      optedOut: outCount,
      blocklisted: blockCount,
      optInRate: contacts.length ? Math.round((inCount / contacts.length) * 100) : 0
    }
  }, [contacts])

  // Filter contacts
  const filtered = useMemo(() => {
    let list = contacts
    if (filterMode === 'opted_in') list = list.filter(c => c.optInStatus === 'opted_in')
    if (filterMode === 'opted_out') list = list.filter(c => c.optInStatus === 'opted_out')
    if (filterMode === 'blocklisted') list = list.filter(c => c.isBlocklisted)
    
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
    }
    return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  }, [contacts, filterMode, search])

  // CSV Import handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    toast({ type: 'loading', message: 'Processing CSV...' })
    
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target.result
      const rows = text.split('\n').map(r => r.trim()).filter(Boolean)
      const headers = rows[0].toLowerCase().split(',')
      
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('number'))
      const nameIdx = headers.findIndex(h => h.includes('name'))
      
      if (phoneIdx === -1) {
        toast({ type: 'error', title: 'Invalid CSV', message: 'Could not find a "phone" column.' })
        setIsImporting(false)
        return
      }
      
      const parsedContacts = rows.slice(1).map(row => {
        const cols = row.split(',')
        return {
          phone: cols[phoneIdx]?.trim(),
          name: nameIdx !== -1 ? cols[nameIdx]?.trim() : 'Unknown',
          optInStatus: 'opted_in',
          optInMethod: 'import',
          optInTimestamp: new Date().toISOString()
        }
      }).filter(c => !!c.phone)

      try {
        const res = await fetch('http://localhost:3001/api/contacts/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: parsedContacts })
        })
        const data = await res.json()
        if (data.success) {
          toast({ type: 'success', title: 'Import Successful', message: `Imported ${data.processed} opted-in contacts.` })
          setTimeout(() => window.location.reload(), 1000) // Lazy refresh context
        } else {
          toast({ type: 'error', title: 'Import Failed', message: data.error })
        }
      } catch (err) {
        toast({ type: 'error', title: 'Network Error', message: 'Failed to contact server.' })
      }
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const exportCsv = () => {
    let csv = 'Name,Phone,Opt-In Status,Method,Blocklisted,Opt-Out Reason\n'
    filtered.forEach(c => {
      csv += `"${c.name}","${c.phone}","${c.optInStatus}","${c.optInMethod || ''}","${c.isBlocklisted}","${c.optOutReason || ''}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getStatusChip = (c) => {
    if (c.isBlocklisted) return <span className="comp-chip chip-block"><Ban size={12}/> Blocklisted</span>
    if (c.optInStatus === 'opted_in') return <span className="comp-chip chip-in"><CheckCircle size={12}/> Opted In</span>
    if (c.optInStatus === 'opted_out') return <span className="comp-chip chip-out"><ShieldAlert size={12}/> Opted Out</span>
    return <span className="comp-chip chip-unknown"><AlertCircle size={12}/> Unknown</span>
  }

  return (
    <div className="page fade-in compliance-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Compliance Management</h1>
          <p className="page-subtitle">Manage consent, blocklists, and Meta messaging policy compliance.</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={Download} onClick={exportCsv}>Export Filtered</Button>
          <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          <Button variant="primary" icon={Upload} onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? 'Importing...' : 'Import Opt-Ins'}
          </Button>
        </div>
      </div>

      <div className="info-hint mb-6">
        <ShieldCheck size={18} className="info-hint-icon" />
        <div className="info-hint-content">
          <strong>Meta Policy Enforcement:</strong>
          <p>Contacts who reply with STOP keywords are automatically opted-out. Sending templates to users without prior opt-in can severely degrade your Account Quality rating.</p>
        </div>
      </div>

      <div className="comp-stats-grid">
        <div className="comp-stat-card">
          <div className="comp-stat-header">
            <span className="comp-stat-label">Total Audience</span>
            <div className="tooltip-container">
              <Info size={14} className="text-muted" />
              <div className="tooltip-content">Total contacts stored in the CRM regardless of consent.</div>
            </div>
          </div>
          <span className="comp-stat-value">{stats.total.toLocaleString()}</span>
        </div>
        <div className="comp-stat-card">
          <div className="comp-stat-header">
            <span className="comp-stat-label">Opted In</span>
            <div className="tooltip-container">
              <CheckCircle className="stat-icon-success" size={14} />
              <div className="tooltip-content">Contacts who explicitly consented to receive broadcasts.</div>
            </div>
          </div>
          <span className="comp-stat-value success">{stats.optedIn.toLocaleString()}</span>
          <div className="comp-stat-progress">
            <div className="comp-stat-fill bg-success" style={{ width: `${stats.optInRate}%` }} />
          </div>
          <span className="comp-stat-sub">{stats.optInRate}% of audience</span>
        </div>
        <div className="comp-stat-card">
          <div className="comp-stat-header">
            <span className="comp-stat-label">Opted Out</span>
            <div className="tooltip-container">
              <AlertTriangle className="stat-icon-warn" size={14} />
              <div className="tooltip-content">Contacts who sent STOP or were manually opted out.</div>
            </div>
          </div>
          <span className="comp-stat-value warn">{stats.optedOut.toLocaleString()}</span>
        </div>
        <div className="comp-stat-card border-danger">
          <div className="comp-stat-header">
            <span className="comp-stat-label text-danger">Blocklisted</span>
            <div className="tooltip-container">
              <Ban className="stat-icon-danger" size={14} />
              <div className="tooltip-content">Permanently blocked contacts. Broadcasts will automatically skip these to protect account health.</div>
            </div>
          </div>
          <span className="comp-stat-value danger">{stats.blocklisted.toLocaleString()}</span>
        </div>
      </div>

      <div className="comp-toolbar">
        <div className="comp-search">
          <Search size={16} className="comp-search-icon" />
          <input 
            className="comp-search-input" 
            placeholder="Search by name or phone..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="comp-filters">
          <button className={`comp-tab ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>All</button>
          <button className={`comp-tab ${filterMode === 'opted_in' ? 'active' : ''}`} onClick={() => setFilterMode('opted_in')}>Opted In</button>
          <button className={`comp-tab ${filterMode === 'opted_out' ? 'active' : ''}`} onClick={() => setFilterMode('opted_out')}>Opted Out</button>
          <button className={`comp-tab ${filterMode === 'blocklisted' ? 'active' : ''}`} onClick={() => setFilterMode('blocklisted')}>Blocklist</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No contacts found"
          description="No contacts match your current filters."
        />
      ) : (
        <div className="comp-table-container">
          <table className="comp-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Status</th>
                <th>Reason/Method</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className={c.isBlocklisted ? 'row-dim' : ''}>
                  <td>
                    <div className="comp-cell-contact">
                      <span className="comp-name">{c.name}</span>
                      <span className="comp-phone">{c.phone}</span>
                    </div>
                  </td>
                  <td>{getStatusChip(c)}</td>
                  <td>
                    <span className="comp-meta-text">
                      {c.isBlocklisted ? c.optOutReason || 'Manual block' : 
                       c.optInStatus === 'opted_in' ? c.optInMethod || 'Unknown' : 
                       c.optInStatus === 'opted_out' ? c.optOutReason || 'Unknown' : '-'}
                    </span>
                  </td>
                  <td>
                    <span className="comp-meta-text">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    <div className="comp-actions">
                      {c.isBlocklisted ? (
                        <Button variant="ghost" size="sm" onClick={() => unblockContact(c.id)}>Unblock</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setBlockConfirmId(c.id)} style={{ color: '#ef4444' }}>Block</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {blockConfirmId && (
        <div className="comp-modal-overlay">
          <div className="comp-modal fade-in-up">
            <div className="comp-modal-icon bg-danger-light">
              <ShieldAlert className="text-danger" size={24} />
            </div>
            <h3 className="comp-modal-title">Confirm Block</h3>
            <p className="comp-modal-desc">
              Are you sure you want to block this contact? They will be permanently skipped in all future broadcasts. This action cannot be undone unless manually unblocked.
            </p>
            <div className="comp-modal-actions">
              <Button variant="ghost" onClick={() => setBlockConfirmId(null)}>Cancel</Button>
              <Button 
                variant="primary" 
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                onClick={() => {
                  blockContact(blockConfirmId)
                  setBlockConfirmId(null)
                  toast({ type: 'success', title: 'Contact Blocked', message: 'Added to blocklist.' })
                }}
              >
                Block Contact
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
}
