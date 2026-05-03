import config from '../config.js';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  BarChart3, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Zap, 
  Server,
  Smartphone
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import './AccountHealth.css';

export default function AccountHealth() {
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch accounts to choose from
  useEffect(() => {
    fetch(config.API_URL + "/accounts")
      .then(res => res.json())
      .then(data => {
        const accountsData = Array.isArray(data) ? data : [];
        setAccounts(accountsData);
        if (accountsData.length > 0) setSelectedId(accountsData[0].id);
      })
      .catch(err => console.error('Failed to load accounts', err));
  }, []);

  const fetchHealth = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${config.API_URL}/accounts/${id}/health`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHealth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchHealth(selectedId);
  }, [selectedId, fetchHealth]);

  const getTierInfo = (tier) => {
    const tiers = {
      'TIER_NOT_SET': { label: 'Trial', limit: '250', desc: 'Limited trial mode' },
      'TIER_100': { label: 'Tier 1', limit: '100', desc: 'Daily business-initiated conversations' },
      'TIER_1K': { label: 'Tier 1', limit: '1,000', desc: 'Daily business-initiated conversations' },
      'TIER_10K': { label: 'Tier 2', limit: '10,000', desc: 'Daily business-initiated conversations' },
      'TIER_100K': { label: 'Tier 3', limit: '100,000', desc: 'Daily business-initiated conversations' },
      'TIER_UNLIMITED': { label: 'Unlimited', limit: '∞', desc: 'No daily conversation limits' },
    };
    return tiers[tier] || { label: tier || 'Unknown', limit: '?', desc: 'Metric fetching...' };
  };

  const getQualityColor = (quality) => {
    switch (quality?.toUpperCase()) {
      case 'GREEN': return '#10b981';
      case 'YELLOW': return '#f59e0b';
      case 'RED': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="page fade-in account-health-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Account Health & Limits</h1>
          <p className="page-subtitle">Real-time Meta Graph API metrics for your WhatsApp Business Accounts</p>
        </div>
        <div className="page-actions">
          <select 
            className="account-selector"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.displayPhoneNumber} ({acc.displayName})</option>
            ))}
          </select>
          <Button 
            variant="ghost" 
            icon={RefreshCw} 
            onClick={() => fetchHealth(selectedId)}
            disabled={loading}
            className={loading ? 'spin' : ''}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {error && (
        <div className="health-error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!health && !loading ? (
        <div className="health-loading-placeholder">Select an account to view metrics</div>
      ) : (
        <div className={`health-dashboard ${loading ? 'loading-state' : ''}`}>
          
          {/* Summary Cards */}
          <div className="health-grid">
            <div className="health-card">
              <div className="health-card-icon tier-icon"><Zap size={24} /></div>
              <div className="health-card-content">
                <div className="health-card-label">Messaging Tier</div>
                <div className="health-card-value">{getTierInfo(health?.phone?.messaging_limit_tier).label}</div>
                <div className="health-card-sub">{getTierInfo(health?.phone?.messaging_limit_tier).limit} / day</div>
              </div>
            </div>

            <div className="health-card">
              <div className="health-card-icon quality-icon" style={{ backgroundColor: getQualityColor(health?.phone?.quality_rating) + '20', color: getQualityColor(health?.phone?.quality_rating) }}>
                <ShieldCheck size={24} />
              </div>
              <div className="health-card-content">
                <div className="health-card-label">Quality Rating</div>
                <div className="health-card-value" style={{ color: getQualityColor(health?.phone?.quality_rating) }}>
                  {health?.phone?.quality_rating || 'UNKNOWN'}
                </div>
                <div className="health-card-sub">Meta Account Health</div>
              </div>
            </div>

            <div className="health-card">
              <div className="health-card-icon status-icon"><Activity size={24} /></div>
              <div className="health-card-content">
                <div className="health-card-label">Phone Status</div>
                <div className="health-card-value">{health?.phone?.status || 'OFFLINE'}</div>
                <div className="health-card-sub">Real-time Connectivity</div>
              </div>
            </div>

            <div className="health-card">
              <div className="health-card-icon mode-icon"><Server size={24} /></div>
              <div className="health-card-content">
                <div className="health-card-label">Account Mode</div>
                <div className="health-card-value">{health?.waba?.account_mode || 'UNKNOWN'}</div>
                <div className="health-card-sub">Sandbox vs Production</div>
              </div>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="health-details-layout">
            <div className="health-section-main">
              <h3 className="section-title"><Smartphone size={18} /> Phone Number Details</h3>
              <div className="details-card">
                <div className="detail-row">
                  <span className="detail-label">Verified Name</span>
                  <span className="detail-value">{health?.phone?.verified_name || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Display Number</span>
                  <span className="detail-value">{health?.phone?.display_phone_number || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Phone Number ID</span>
                  <span className="detail-value mono">{health?.phone?.id || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Messaging Tier Detail</span>
                  <span className="detail-value">{getTierInfo(health?.phone?.messaging_limit_tier).desc}</span>
                </div>
              </div>

              <h3 className="section-title mt-6"><BarChart3 size={18} /> Business Account (WABA)</h3>
              <div className="details-card">
                <div className="detail-row">
                  <span className="detail-label">WABA Name</span>
                  <span className="detail-value">{health?.waba?.name || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">WABA Status</span>
                  <span className="detail-value">
                    <Chip label={health?.waba?.status || 'Unknown'} status={health?.waba?.status === 'APPROVED' ? 'approved' : 'pending'} />
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">WABA ID</span>
                  <span className="detail-value mono">{health?.waba?.id || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="health-section-side">
              <div className="guide-card">
                <h4 className="guide-title"><AlertCircle size={16} /> Messaging Tier Guide</h4>
                <p className="guide-text">Your tier determines how many unique customers you can start conversations with every 24 hours.</p>
                <ul className="guide-list">
                  <li><strong>Tier 1:</strong> 1,000 customers</li>
                  <li><strong>Tier 2:</strong> 10,000 customers</li>
                  <li><strong>Tier 3:</strong> 100,000 customers</li>
                  <li><strong>Unlimited:</strong> No limit</li>
                </ul>
                <div className="guide-tip">
                  <strong>How to scale:</strong> Send more than half your limit in a 7-day period with high quality ratings to move to the next tier automatically.
                </div>
              </div>
            </div>
          </div>

          <div className="health-footer">
            <RefreshCw size={12} /> Last synced with Meta: {health?.lastUpdated ? new Date(health.lastUpdated).toLocaleTimeString() : 'Just now'}
          </div>
        </div>
      )}
    </div>
  );
}
