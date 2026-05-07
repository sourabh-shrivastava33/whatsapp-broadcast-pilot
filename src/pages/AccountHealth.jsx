import config from '../config.js';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Activity, 
  ShieldCheck, 
  BarChart3, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Zap, 
  Server,
  Smartphone,
  ChevronRight,
  Info,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Layout,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Modal } from '../components/ui/Modal';
import './AccountHealth.css';

const HealthMetricCard = ({ label, value, sub, icon: Icon, color, children }) => (
  <div className="metric-card fade-in">
    <div className="card-header">
      <span className="card-label">{label}</span>
      {Icon && <Icon size={14} style={{ color }} />}
    </div>
    <div className="metric-content">
      {children || (
        <>
          <div className="metric-value">{value}</div>
          <div className="metric-sub">{sub}</div>
        </>
      )}
    </div>
  </div>
);

export default function AccountHealth() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, title: '', content: null });

  // Fetch accounts to choose from
  useEffect(() => {
    authFetch(config.API_URL + "/accounts")
      .then(res => res.json())
      .then(data => {
        const accountsData = Array.isArray(data) ? data : [];
        setAccounts(accountsData);
        if (accountsData.length > 0) setSelectedId(accountsData[0].id);
      })
      .catch(err => console.error('Failed to load accounts', err));
  }, [authFetch]);

  const fetchHealth = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${config.API_URL}/accounts/${id}/health`);
      const payload = await res.json();
      if (payload.error) throw new Error(payload.error);
      setData(payload.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (selectedId) fetchHealth(selectedId);
  }, [selectedId, fetchHealth]);

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  if (loading && !data) return <HealthSkeleton />;

  return (
    <div className="page fade-in account-health-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Account</span> <ChevronRight size={14} /> <span>Health & Limits</span>
          </div>
          <h1 className="page-title">Account Health & Limits <ShieldCheck size={20} className="verified-icon" /></h1>
          <p className="page-subtitle">Real-time Meta Graph API metrics for your WhatsApp Business Accounts</p>
        </div>
        <div className="page-actions">
          <select 
            className="account-selector"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.displayPhoneNumber || acc.displayName}</option>
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
          <div className="last-updated-text">
            Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </div>

      {error && (
        <div className={`health-error-banner ${error.includes('Expired') ? 'session-expired' : ''}`} style={{ marginBottom: 'var(--space-xl)' }}>
          <AlertCircle size={20} />
          <div className="error-content">
            <strong>{error.includes('Expired') ? 'Meta Session Expired' : 'API Connection Error'}</strong>
            <p>{error}</p>
          </div>
          {error.includes('Expired') && (
            <Button variant="outline" size="sm" onClick={() => navigate('/accounts')} className="ml-auto">
              Update Token
            </Button>
          )}
        </div>
      )}

      {data && (
        <div className="health-dashboard-v2">
          
          {/* Top Metric Cards */}
          <div className="top-metrics-grid">
            <HealthMetricCard 
              label="HEALTH SCORE" 
              icon={() => <Info size={14} className="info-icon-clickable" onClick={() => setModal({
                open: true,
                title: 'Health Score Logic',
                content: (
                  <div className="modal-info-content">
                    <p>Your health score is a proprietary metric calculated using real-time signals from Meta:</p>
                    <ul className="info-list-bullets">
                      <li><strong>Quality Rating (60%):</strong> Green (+0), Yellow (-30), Red (-60)</li>
                      <li><strong>Account Mode (20%):</strong> Production (+20), Sandbox (+10)</li>
                      <li><strong>Connectivity (20%):</strong> Connected (+20), Flagged (-40)</li>
                    </ul>
                    <div className="info-hint mt-4">
                      <Zap size={14} /> Maintaining a score above 90 ensures your templates aren't paused and your messaging limits can increase.
                    </div>
                  </div>
                )
              })} />}
            >
              <div className="health-score-content">
                <div className="circular-progress-v3" style={{ '--progress': `${data.score}%`, '--color': getScoreColor(data.score) }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle className="progress-bg" cx="32" cy="32" r="28" />
                    <circle 
                      className="progress-fill" 
                      cx="32" 
                      cy="32" 
                      r="28" 
                      style={{ 
                        strokeDasharray: '175.9', 
                        strokeDashoffset: 175.9 - (175.9 * (data?.score || 0)) / 100,
                        stroke: getScoreColor(data?.score || 0)
                      }} 
                    />
                  </svg>
                  <span className="score-number">{data?.score || 0}</span>
                </div>
                <div className="score-details">
                  <span className="score-label" style={{ color: getScoreColor(data?.score || 0) }}>{getScoreLabel(data?.score || 0)}</span>
                  <span className="score-desc">Operational Status</span>
                </div>
              </div>
            </HealthMetricCard>

            <HealthMetricCard 
              label="MESSAGING TIER" 
              icon={() => <Info size={14} className="info-icon-clickable" onClick={() => setModal({
                open: true,
                title: 'About Messaging Tiers',
                content: (
                  <div className="modal-info-content">
                    <p>Messaging limits determine the number of business-initiated conversations your phone number can start in a 24-hour period.</p>
                    <div className="tier-grid">
                      <div className="tier-row"><span>Tier 250</span> <span>Trial</span></div>
                      <div className="tier-row"><span>Tier 1K</span> <span>Standard</span></div>
                      <div className="tier-row"><span>Tier 10K</span> <span>Scale</span></div>
                      <div className="tier-row"><span>Tier 100K+</span> <span>Unlimited</span></div>
                    </div>
                    <p className="mt-4">Limits increase automatically when you reach 50% of your current tier with High Quality rating.</p>
                  </div>
                )
              })} />}
              color="#a855f7"
            >
              <div className="tier-title">Tier {data?.limit >= 1000 ? `${data?.limit/1000}K` : (data?.limit || 'N/A')}</div>
              <div className="tier-subtitle">{data?.limit?.toLocaleString() || 0} msg/day</div>
              <div className="tier-progress-v3">
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${Math.min(100, (data?.usage?.businessInitiated / (data?.limit || 1)) * 100)}%` }}></div>
                </div>
                <div className="progress-footer">{data?.usage?.businessInitiated || 0} used today</div>
              </div>
            </HealthMetricCard>

            <HealthMetricCard 
              label="QUALITY RATING" 
              icon={() => <ShieldCheck size={14} className="info-icon-clickable" onClick={() => setModal({
                open: true,
                title: 'Quality Rating Details',
                content: (
                  <div className="modal-info-content">
                    <p>The quality rating is based on how customers have received your messages over the last 7 days.</p>
                    <div className="quality-indicators">
                      <div className="q-item"><div className="dot green"></div> <strong>High:</strong> Good feedback, low block rate</div>
                      <div className="q-item"><div className="dot yellow"></div> <strong>Medium:</strong> Some negative feedback detected</div>
                      <div className="q-item"><div className="dot red"></div> <strong>Low:</strong> High report/block rate. Risk of suspension.</div>
                    </div>
                  </div>
                )
              })} />}
              color={getScoreColor(data?.score || 0)}
            >
              <div className="quality-badge-v3" style={{ background: `${getScoreColor(data?.score || 0)}20`, color: getScoreColor(data?.score || 0) }}>
                {data?.quality || 'GREEN'}
              </div>
              <div className="quality-subtitle">High performance</div>
              <button className="text-link-sm" onClick={() => navigate('/compliance')}>
                View history <ChevronRight size={10} />
              </button>
            </HealthMetricCard>

            <HealthMetricCard 
              label="PHONE STATUS" 
              icon={Activity}
              color="#10b981"
            >
              <div className="status-title-v3">Connected</div>
              <div className="status-check-v3"><CheckCircle2 size={12} /> Verified</div>
              <button className="text-link-sm" onClick={() => window.open('https://business.facebook.com/wa/manage/phone-numbers/', '_blank')}>
                Manage in Meta <ExternalLink size={10} />
              </button>
            </HealthMetricCard>

            <HealthMetricCard 
              label="ACCOUNT MODE" 
              icon={Layout}
            >
              <div className="mode-title-v3">{data?.mode === 'SANDBOX' ? 'Sandbox' : 'Production'}</div>
              <div className="mode-badge-v3">{data?.mode === 'SANDBOX' ? 'Test Mode' : 'Live Mode'}</div>
              <button className="text-link-sm" onClick={() => setModal({ 
                open: true, 
                title: 'How to switch to Production', 
                content: <div className="modal-info-content"><p>To go live, you need to verify your business on Meta and add a permanent phone number.</p><Button className="mt-4" onClick={() => window.open('https://developers.facebook.com/docs/whatsapp/cloud-api/get-started', '_blank')}>Documentation</Button></div> 
              })}>
                Upgrade path
              </button>
            </HealthMetricCard>
          </div>

          {/* Alerts Banner */}
          {data?.mode === 'SANDBOX' && (
            <div className="readiness-banner" style={{ margin: 'var(--space-lg) 0 var(--space-2xl)' }}>
              <div className="banner-icon"><AlertTriangle size={20} /></div>
              <div className="banner-content">
                <strong>Production readiness</strong>
                <p>You are using a test number. Some metrics are limited. Switch to a live number to unlock all features and higher messaging tiers.</p>
              </div>
              <Button variant="outline" size="sm">Learn how to go live <ChevronRight size={14} /></Button>
            </div>
          )}

          <div className="dashboard-main-grid">
            <div className="dashboard-content-left">
              {/* Messaging Limits Overview */}
              <div className="content-card limits-overview">
                <h3 className="card-title">Messaging Limits Overview <Info size={14} className="info-icon-clickable" onClick={() => setModal({ open: true, title: 'Limits Explained', content: <p>Conversations are measured in 24-hour windows. User-initiated conversations are free and unlimited (up to 1,000 per month for certain accounts).</p> })} /></h3>
                <div className="limits-body">
                  <div className="limit-circle-section">
                    <div className="limit-circle">
                      <div className="circle-inner">
                        <span className="circle-value">{data?.usage?.businessInitiated || 0}</span>
                        <span className="circle-label">/ {data?.limit || 0}</span>
                      </div>
                    </div>
                    <div className="limit-circle-desc">
                      <Clock size={12} /> Resets in {data?.usage?.resetTime || 'N/A'}
                    </div>
                  </div>
                  <div className="limit-stats-section">
                    <div className="limit-stat-row">
                      <div className="stat-info">
                        <span className="stat-label">Business Initiated</span>
                        <span className="stat-count">{data?.usage?.businessInitiated || 0} / {data?.limit || 0}</span>
                      </div>
                      <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: `${Math.min(100, ((data?.usage?.businessInitiated || 0) / (data?.limit || 1)) * 100)}%` }}></div></div>
                    </div>
                    <div className="limit-stat-row">
                      <div className="stat-info">
                        <span className="stat-label">User Initiated</span>
                        <span className="stat-count">{data?.usage?.userInitiated || 0} / Unlimited</span>
                      </div>
                      <div className="stat-bar-bg"><div className="stat-bar-fill" style={{ width: '5%', background: '#3b82f6' }}></div></div>
                    </div>
                    <button className="text-link-sm mt-2" onClick={() => setModal({ open: true, title: 'Tier Upgrade Path', content: <p>To upgrade your tier, send at least half your current limit in a 7-day window with High Quality rating.</p> })}>
                      How to upgrade tier <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Risk & Compliance */}
              <div className="content-card risk-compliance">
                <h3 className="card-title">Risk & Compliance</h3>
                <div className="risk-status-banner" style={{ background: (data?.score || 0) < 70 ? 'rgba(218, 54, 51, 0.1)' : '', color: (data?.score || 0) < 70 ? 'var(--status-rejected)' : '' }}>
                  {(data?.score || 0) >= 90 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <div>
                    <strong>{(data?.score || 0) >= 90 ? 'No critical issues' : ((data?.score || 0) >= 70 ? 'Potential issues' : 'Critical Warning')}</strong>
                    <p>{(data?.score || 0) >= 90 ? 'Great! Your account is compliant with WhatsApp policies.' : 'Review recent activity to avoid account restrictions.'}</p>
                  </div>
                </div>
                <div className="risk-table">
                  <div className="risk-item"><span>Account restrictions</span> <span className={data.risk?.restrictions === 'None' ? 'status-none' : 'status-low'}>{data.risk?.restrictions || 'None'}</span></div>
                  <div className="risk-item"><span>Policy violations</span> <span className="status-none">{data.risk?.violations || 0}</span></div>
                  <div className="risk-item"><span>Spam rate</span> <span className={data.risk?.spamRate === 'Low' ? 'status-none' : 'status-low'}>{data.risk?.spamRate || 'Low'}</span></div>
                  <div className="risk-item"><span>User blocks</span> <span className="value-percent">{data.risk?.blocks || '0.00%'}</span></div>
                  <div className="risk-item"><span>Report rate</span> <span className="value-percent">{data.risk?.reports || '0.00%'}</span></div>
                </div>
                <button className="text-link-sm mt-4" onClick={() => window.open('https://www.whatsapp.com/legal/business-policy/', '_blank')}>
                  WhatsApp Business Policy <ExternalLink size={12} />
                </button>
              </div>

              {/* Template Quality */}
              <div className="content-card template-quality">
                <div className="card-header-row">
                  <h3 className="card-title">Template Quality <span className="sub">(Latest)</span></h3>
                  <button className="text-link-sm" onClick={() => navigate('/templates')}>View all templates <ChevronRight size={14} /></button>
                </div>
                <table className="quality-table">
                  <thead>
                    <tr>
                      <th>TEMPLATE NAME</th>
                      <th>QUALITY</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.templates?.length > 0 ? data.templates.map((t, i) => (
                      <tr key={i}>
                        <td>{t?.name} <span className="cat">{t?.category}</span></td>
                        <td>
                          <span className={`dot ${t?.quality === 'HIGH' || t?.quality === 'UNKNOWN' ? 'green' : 'yellow'}`}></span> 
                          {t?.quality}
                        </td>
                        <td><Chip label={t?.status} status={t?.status === 'APPROVED' ? 'approved' : 'pending'} size="sm" /></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>No templates found for this account</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dashboard-content-right">
              {/* Active Alerts */}
              <div className="side-card alerts-card">
                <div className="side-card-header">
                  <h3 className="side-card-title">Active Alerts <span className="badge-count">{data?.alerts?.length || 0}</span></h3>
                  <button className="text-link-sm" onClick={() => navigate('/compliance')}>
                    View all alerts <ChevronRight size={14} />
                  </button>
                </div>
                <div className="alert-list">
                  {data?.alerts?.map((alert, idx) => (
                    <div key={idx} className={`alert-item alert-${alert?.type}`}>
                      <div className="alert-icon">
                        {alert?.type === 'error' ? <ShieldAlert size={16} /> : <AlertCircle size={16} />}
                      </div>
                      <div className="alert-body">
                        <p className="alert-message">{alert?.message}</p>
                        <span className="alert-time">{alert?.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'N/A'}</span>
                      </div>
                    </div>
                  )) || <div className="empty-alerts">No active alerts</div>}
                </div>
              </div>

              {/* Recommendations */}
              <div className="side-card recs-card">
                <h3 className="side-card-title">Recommendations for you</h3>
                <div className="rec-list">
                  {data?.recommendations?.map((rec, idx) => (
                    <div key={idx} className="rec-item">
                      <div className="rec-icon"><ArrowUpRight size={16} /></div>
                      <p className="rec-text">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Account Information */}
              <div className="side-card info-card">
                <h3 className="side-card-title">Account Information</h3>
                <div className="info-list">
                  <div className="info-item"><span className="label">Verified Name</span> <span className="value">{data?.verifiedName || 'N/A'}</span></div>
                  <div className="info-item"><span className="label">Display Number</span> <span className="value">+{data?.displayPhoneNumber || 'Test Number'}</span></div>
                  <div className="info-item"><span className="label">WABA ID</span> <span className="value mono">{data?.id || 'N/A'}</span></div>
                  <div className="info-item"><span className="label">WABA Status</span> <span className="value"><Chip label={data?.wabaStatus} status={data?.wabaStatus === 'APPROVED' ? 'approved' : 'pending'} size="sm" /></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Global Info Modal */}
      <Modal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })}
        title={modal.title}
      >
        {modal.content}
      </Modal>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="page health-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-line w-1/3"></div>
        <div className="skeleton-line w-2/3 h-10 mt-4"></div>
      </div>
      <div className="skeleton-grid mt-8">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton-card h-40"></div>)}
      </div>
      <div className="skeleton-layout mt-8">
        <div className="skeleton-main">
          <div className="skeleton-card h-80"></div>
          <div className="skeleton-card h-60 mt-6"></div>
        </div>
        <div className="skeleton-side">
          <div className="skeleton-card h-40"></div>
          <div className="skeleton-card h-40 mt-6"></div>
        </div>
      </div>
    </div>
  );
}
