import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Archive, 
  Download, 
  ExternalLink, 
  Tag as TagIcon, 
  Calendar, 
  FileText, 
  Activity,
  Layout,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Edit2,
  Copy,
  Move,
  ArrowRight,
  Info
} from 'lucide-react';
import { useMedia } from '../../store/MediaContext';
import { Button } from './Button';
import { Chip } from './Chip';
import './MediaDetailsSidebar.css';

export function MediaDetailsSidebar({ item, onClose }) {
  const { updateMedia, duplicateMedia, archiveMedia, deleteMedia, fetchUsage } = useMedia();
  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    tags: item.tags || [],
    campaign: item.campaign || '',
  });
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const { folders } = useMedia();

  useEffect(() => {
    if (item) {
      setLoadingUsage(true);
      fetchUsage(item.id)
        .then(data => setUsage(data))
        .finally(() => setLoadingUsage(false));
      
      setEditData({
        tags: item.tags || [],
        campaign: item.campaign || '',
      });
      setIsEditing(false);
    }
  }, [item, fetchUsage]);

  if (!item) return null;

  const handleDuplicate = async () => {
    try {
      await duplicateMedia(item.id);
      alert('Asset duplicated successfully');
    } catch (err) {
      alert('Duplication failed');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMedia(item.id, editData);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const getCompatibility = () => {
    const isSmall = item.size <= 5 * 1024 * 1024;
    const isImage = item.type === 'IMAGE';
    
    return [
      { label: 'Compatible with:', targets: [
        { name: 'Template Header', ok: isImage && isSmall },
        { name: 'Carousel', ok: isImage },
        { name: 'Product Message', ok: isImage && isSmall }
      ]},
      { label: 'Not recommended for:', targets: [
        { name: 'Document Message', ok: !isImage }
      ]}
    ];
  };

  return (
    <div className="media-sidebar fade-in">
      <div className="media-sidebar-header">
        <div className="header-title-group">
          <Activity size={18} className="text-accent" />
          <h3>Media Details</h3>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close details">
          <X size={22} />
        </button>
      </div>

      <div className="media-sidebar-content">
        {/* Top Asset Info */}
        <div className="sidebar-asset-info">
          <div className="sidebar-thumbnail">
            {item.type === 'IMAGE' ? (
              <img src={item.url} alt="" />
            ) : (
              <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <FileText size={32} />
              </div>
            )}
          </div>
          <div className="sidebar-main-meta">
            <div className="sidebar-filename" title={item.filename}>{item.filename}</div>
            <div className="sidebar-specs">
              {(item.size / 1024).toFixed(1)} KB • {item.metadata?.mimetype || item.type}
            </div>
            <div className="sidebar-specs">
              {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • Admin
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="sidebar-section">
          <h4>
            Tags
            {!isEditing && <Edit2 size={14} className="edit-trigger" onClick={() => setIsEditing(true)} />}
          </h4>
          {isEditing ? (
            <div className="tag-edit-box">
              <div className="tag-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input 
                  type="text" 
                  value={newTag} 
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      setEditData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
                      setNewTag('');
                    }
                  }}
                  placeholder="Add tag..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-primary)' }}
                />
                <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
                </Button>
              </div>
              <div className="sidebar-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {editData.tags.map(tag => (
                  <Chip 
                    key={tag} 
                    label={tag} 
                    onRemove={() => setEditData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))} 
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="sidebar-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {item.tags?.length > 0 ? (
                item.tags.map(tag => <Chip key={tag} label={tag} status="default" />)
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tags added</span>
              )}
            </div>
          )}
        </div>

        {/* Used In Section */}
        <div className="sidebar-section">
          <h4>Used In</h4>
          {loadingUsage ? (
            <Loader2 className="spin" size={16} />
          ) : usage?.templates?.length > 0 ? (
            <div className="usage-list">
              {usage.templates.slice(0, 3).map(t => (
                <div key={t.id} className="usage-item">
                  <span className="usage-name">Template: {t.name}</span>
                  <span className="usage-type">Header Image</span>
                </div>
              ))}
              <div className="view-all-link">
                <span>View all usage ({usage.templates.length})</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not used in any templates yet</span>
          )}
        </div>

        {/* Compatibility Section */}
        <div className="sidebar-section">
          <h4>Compatibility</h4>
          <div className="compatibility-list">
            {getCompatibility().map((group, idx) => (
              <div key={idx} className="compat-group">
                <div className="compat-label" style={{ fontSize: '11px', marginBottom: '8px' }}>{group.label}</div>
                <div className="compat-status">
                  {group.targets.map(t => (
                    <Chip 
                      key={t.name} 
                      label={t.name} 
                      status={t.ok ? 'approved' : 'rejected'} 
                      icon={t.ok ? CheckCircle2 : AlertCircle}
                      className="text-xs"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Grid */}
        <div className="sidebar-section">
          <h4>Actions</h4>
          <div className="sidebar-actions-grid">
            <div className="action-card" onClick={() => setIsEditing(true)}>
              <Edit2 size={18} />
              <span>Edit Details</span>
            </div>
            <a 
              className="action-card" 
              href={item.url} 
              download={item.filename}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Download size={18} />
              <span>Download</span>
            </a>
            <div className="action-card" onClick={() => setShowMoveMenu(!showMoveMenu)}>
              <Move size={18} />
              <span>Move</span>
            </div>
            <div className="action-card" onClick={handleDuplicate}>
              <Copy size={18} />
              <span>Duplicate</span>
            </div>
            <div className="action-card" onClick={() => archiveMedia(item.id)}>
              <Archive size={18} />
              <span>Archive</span>
            </div>
            <div className="action-card danger" onClick={() => {
              if (window.confirm('Are you sure you want to delete this asset?')) {
                deleteMedia(item.id).then(() => onClose());
              }
            }}>
              <Trash2 size={18} />
              <span>Delete</span>
            </div>
          </div>

          {showMoveMenu && (
            <div className="move-selection-box fade-in" style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-muted)' }}>MOVE TO FOLDER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div 
                  className="dropdown-item" 
                  onClick={() => moveMedia(item.id, null).then(() => setShowMoveMenu(false))}
                  style={{ borderRadius: '4px' }}
                >
                  <span>Root / All Media</span>
                  {!item.folderId && <CheckCircle2 size={12} className="text-accent" />}
                </div>
                {folders.map(f => (
                  <div 
                    key={f.id} 
                    className="dropdown-item" 
                    onClick={() => moveMedia(item.id, f.id).then(() => setShowMoveMenu(false))}
                    style={{ borderRadius: '4px' }}
                  >
                    <span>{f.name}</span>
                    {item.folderId === f.id && <CheckCircle2 size={12} className="text-accent" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
