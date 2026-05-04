import React from 'react';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import IndianRupee from 'lucide-react/dist/esm/icons/indian-rupee';
import Home from 'lucide-react/dist/esm/icons/home';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import UserCheck from 'lucide-react/dist/esm/icons/user-check';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import './LeadIntelligenceCard.css';

export function LeadIntelligenceCard({ contact }) {
  if (!contact) return null;

  const data = contact.qualificationData || {};
  const score = contact.intentScore || 0;
  
  const getScoreColor = (s) => {
    if (s >= 70) return '#22c55e'; // Hot
    if (s >= 40) return '#eab308'; // Warm
    return '#64748b'; // Cold
  };

  return (
    <div className="lead-intel-container">
      {/* Static Header Section */}
      <div className="intel-static-header">
        <div className="intel-section">
          <div className="intel-header">
            <TrendingUp size={16} />
            <h3>Intent Score</h3>
          </div>
          <div className="intent-meter">
            <div className="meter-bar">
              <div 
                className="meter-fill" 
                style={{ width: `${score}%`, backgroundColor: getScoreColor(score), color: getScoreColor(score) }}
              />
            </div>
            <div className="score-row">
              <span className="score-text" style={{ color: getScoreColor(score) }}>{score}%</span>
              <span className="score-label">{score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold'}</span>
            </div>
          </div>
        </div>

        <div className="intel-section">
          <div className="intel-header">
            <Sparkles size={16} />
            <h3>AI Insights</h3>
          </div>
          <p className="ai-summary-text">{contact.aiSummary || "No insights generated yet. The AI is analyzing the conversation..."}</p>
        </div>
      </div>

      {/* Scrollable Stats Section */}
      <div className="intel-scrollable-body">
        <div className="intel-section-title">Qualification Details</div>
        <div className="intel-grid">
          <div className="intel-item">
            <div className="intel-icon-box"><IndianRupee size={14} /></div>
            <div className="intel-item-content">
              <label>Budget</label>
              <span>{data.budget || 'Not set'}</span>
            </div>
          </div>
          <div className="intel-item">
            <div className="intel-icon-box"><MapPin size={14} /></div>
            <div className="intel-item-content">
              <label>Location</label>
              <span>{data.location || 'Not set'}</span>
            </div>
          </div>
          <div className="intel-item">
            <div className="intel-icon-box"><Home size={14} /></div>
            <div className="intel-item-content">
              <label>Property Type</label>
              <span>{data.propertyType || 'Not set'}</span>
            </div>
          </div>
          <div className="intel-item">
            <div className="intel-icon-box"><Calendar size={14} /></div>
            <div className="intel-item-content">
              <label>Timeline</label>
              <span>{data.timeline || 'Not set'}</span>
            </div>
          </div>
          <div className="intel-item">
            <div className="intel-icon-box"><UserCheck size={14} /></div>
            <div className="intel-item-content">
              <label>Loan Readiness</label>
              <span>{data.loanReadiness || 'Not set'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Static Footer Section */}
      <div className="intel-static-footer">
        <div className="intel-header">
          <Calendar size={14} />
          <h3>Recommended Action</h3>
        </div>
        <div className="next-action-badge">
          {contact.nextAction || "Waiting for signal..."}
        </div>
      </div>
    </div>
  );
}
