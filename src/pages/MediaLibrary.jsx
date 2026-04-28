import React, { useState, useMemo } from 'react';
import { useMedia } from '../store/MediaContext';
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as AudioIcon, 
  FileText as FileIcon, 
  Plus, 
  Loader2,
  Search,
  CheckCircle2,
  FileUp
} from 'lucide-react';
import './MediaLibrary.css';
import { Button } from '../components/ui/Button';
import { FilterChip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';

const MEDIA_TYPES = [
  { id: 'IMAGE', label: 'Images', icon: ImageIcon },
  { id: 'VIDEO', label: 'Videos', icon: VideoIcon },
  { id: 'AUDIO', label: 'Audio', icon: AudioIcon },
  { id: 'DOCUMENT', label: 'Documents', icon: FileIcon },
];

export default function MediaLibrary() {
  const { media, loading, uploadMedia } = useMedia();
  const [activeTab, setActiveTab] = useState('IMAGE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const filteredMedia = useMemo(() => {
    return media.filter(m => 
      m.type === activeTab && 
      (m.filename.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [media, activeTab, searchQuery]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadMedia(file);
      if (file.type.startsWith('image/')) setActiveTab('IMAGE');
      else if (file.type.startsWith('video/')) setActiveTab('VIDEO');
      else if (file.type.startsWith('audio/')) setActiveTab('AUDIO');
      else setActiveTab('DOCUMENT');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="page fade-in media-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Media Library</h1>
          <p className="page-subtitle">
            Manage your assets for WhatsApp templates and broadcasts
          </p>
        </div>
        <div className="page-actions">
          <label className="button button-primary" style={{ cursor: 'pointer', position: 'relative' }}>
            {isUploading ? (
              <Loader2 className="button-icon spin" size={16} />
            ) : (
              <FileUp className="button-icon" size={16} />
            )}
            <span>{isUploading ? 'Uploading...' : 'Upload Media'}</span>
            <input 
              type="file" 
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
              onChange={handleFileUpload} 
              disabled={isUploading} 
            />
          </label>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {MEDIA_TYPES.map((type) => (
            <FilterChip
              key={type.id}
              label={type.label}
              active={activeTab === type.id}
              onClick={() => setActiveTab(type.id)}
              icon={type.icon}
            />
          ))}
        </div>
        
        <div style={{ marginLeft: 'auto', width: '280px' }}>
          <div className="search-input-wrapper" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}s...`}
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '36px' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ textAlign: 'center', padding: '100px' }}>
          <Loader2 className="spin" size={32} style={{ color: 'var(--accent-primary)' }} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading media library...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <EmptyState
          icon={activeTab === 'IMAGE' ? ImageIcon : activeTab === 'VIDEO' ? VideoIcon : FileIcon}
          title={`No ${activeTab.toLowerCase()}s found`}
          description={searchQuery ? `No files match "${searchQuery}"` : `Upload your first ${activeTab.toLowerCase()} to get started.`}
          actionLabel={searchQuery ? null : "Upload Media"}
          onAction={searchQuery ? null : () => document.querySelector('input[type="file"]').click()}
        />
      ) : (
        <div className="media-grid">
          {filteredMedia.map((item) => (
            <div key={item.id} className="media-item-card">
              <div className="media-item-preview">
                {item.type === 'IMAGE' ? (
                  <img src={item.url} alt={item.filename} />
                ) : (
                  <div className="media-item-icon">
                    {item.type === 'VIDEO' ? <VideoIcon size={32} /> :
                     item.type === 'AUDIO' ? <AudioIcon size={32} /> :
                     <FileIcon size={32} />}
                  </div>
                )}
              </div>
              <div className="media-item-info">
                <div className="media-item-name">{item.filename}</div>
                <div className="media-item-meta">
                  {(item.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
