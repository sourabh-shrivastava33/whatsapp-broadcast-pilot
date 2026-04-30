import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight, Check } from 'lucide-react'
import './CommandStrip.css'

const demoSteps = [
  { id: 1, label: 'Connect Account', path: '/accounts' },
  { id: 2, label: 'Add Contacts', path: '/contacts' },
  { id: 3, label: 'Create Template', path: '/templates' },
  { id: 4, label: 'Broadcast', path: '/broadcast' },
]

export function CommandStrip() {
  const location = useLocation()
  const [activeStep, setActiveStep] = useState(0)

  // Auto-cycle through steps for the wow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (demoSteps.length + 1))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Override with actual navigation
  useEffect(() => {
    const matchedStep = demoSteps.findIndex((s) => s.path === location.pathname)
    if (matchedStep !== -1) {
      setActiveStep(matchedStep + 1)
    }
  }, [location.pathname])

  const isFlowPage = demoSteps.some(s => s.path === location.pathname) || location.pathname === '/'
  if (!isFlowPage) return null

  return (
    <div className="command-strip">
      <div className="command-strip-inner">
        {demoSteps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div
              className={`command-strip-step ${
                idx + 1 === activeStep ? 'active' : ''
              } ${idx + 1 < activeStep ? 'completed' : ''}`}
            >
              <span className="command-strip-step-number">
                {idx + 1 < activeStep ? <Check size={10} /> : step.id}
              </span>
              {step.label}
            </div>
            {idx < demoSteps.length - 1 && (
              <ChevronRight size={12} className="command-strip-arrow" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
