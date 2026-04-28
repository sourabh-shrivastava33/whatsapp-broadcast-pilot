import React, { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useAccounts } from '../../store/AccountsContext'

export function ConnectAccountModal({ isOpen, onClose }) {
  const { addAccount } = useAccounts()
  
  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumberId: '',
    accessToken: '',
    businessLabel: ''
  })
  const [errors, setErrors] = useState({})

  // Reset state when opening/closing
  React.useEffect(() => {
    if (isOpen) {
      setFormData({ displayName: '', phoneNumberId: '', accessToken: '', businessLabel: '' })
      setErrors({})
    }
  }, [isOpen])

  const validate = () => {
    const newErrors = {}
    if (!formData.displayName.trim()) newErrors.displayName = 'Display Name is required'
    if (!formData.phoneNumberId.trim()) newErrors.phoneNumberId = 'Phone Number ID is required'
    else if (!/^\d+$/.test(formData.phoneNumberId)) newErrors.phoneNumberId = 'Phone Number ID must be numeric'
    if (!formData.accessToken.trim()) newErrors.accessToken = 'Access Token is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      addAccount({
        displayName: formData.displayName.trim(),
        phoneNumberId: formData.phoneNumberId.trim(),
        accessToken: formData.accessToken.trim(),
        businessLabel: formData.businessLabel.trim()
      })
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect WhatsApp Account"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Connect</Button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="displayName">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          placeholder="e.g. Acme Corp Support"
          value={formData.displayName}
          onChange={(e) => setFormData(p => ({ ...p, displayName: e.target.value }))}
          className={errors.displayName ? 'error' : ''}
        />
        {errors.displayName && <span className="form-error">{errors.displayName}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="phoneNumberId">
          Phone Number ID
        </label>
        <input
          id="phoneNumberId"
          type="text"
          placeholder="e.g. 10293847561"
          value={formData.phoneNumberId}
          onChange={(e) => setFormData(p => ({ ...p, phoneNumberId: e.target.value }))}
          className={errors.phoneNumberId ? 'error' : ''}
        />
        <div className="form-hint">From your Meta App Dashboard &gt; WhatsApp &gt; API Setup.</div>
        {errors.phoneNumberId && <span className="form-error">{errors.phoneNumberId}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="accessToken">
          System User Access Token
        </label>
        <input
          id="accessToken"
          type="password"
          placeholder="EAXXXXXXXXXXXX..."
          value={formData.accessToken}
          onChange={(e) => setFormData(p => ({ ...p, accessToken: e.target.value }))}
          className={errors.accessToken ? 'error' : ''}
        />
        {errors.accessToken && <span className="form-error">{errors.accessToken}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="businessLabel">
          Business Label <span className="form-label-optional">(Optional)</span>
        </label>
        <input
          id="businessLabel"
          type="text"
          placeholder="e.g. EU Region"
          value={formData.businessLabel}
          onChange={(e) => setFormData(p => ({ ...p, businessLabel: e.target.value }))}
        />
      </div>
    </Modal>
  )
}
