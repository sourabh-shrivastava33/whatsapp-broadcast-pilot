import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  FileUp,
  Grid,
  List as ListIcon,
  Filter,
  ChevronDown,
  ArrowUpDown,
  MoreVertical,
  X,
  Archive as ArchiveIcon,
  Layout,
  MessageSquare,
  FolderPlus,
  Folder,
  ChevronLeft,
  ChevronRight,
  Link2,
  Check
} from 'lucide-react';
import './MediaLibrary.css';
import { Button } from '../components/ui/Button';
import { Chip, FilterChip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { MediaDetailsSidebar } from '../components/ui/MediaDetailsSidebar';

const MEDIA_TABS = [
  { id: 'ALL', label: 'All Media' },
  { id: 'IMAGE', label: 'Images' },
  { id: 'VIDEO', label: 'Videos' },
  { id: 'AUDIO', label: 'Audio' },
  { id: 'DOCUMENT', label: 'Documents' },
];

const SORT_OPTIONS = [
  { id: 'desc', label: 'Latest First' },
  { id: 'asc', label: 'Oldest First' },
  { id: 'size_desc', label: 'Size (Large First)' },
];

export default function MediaLibrary() {
  const { 
    media, 
    folders,
    pagination,
    loading, 
    fetchMedia, 
    uploadMedia,
    createFolder 
  } = useMedia();

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('desc');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Dropdown States
  const [activeDropdown, setActiveDropdown] = useState(null); // 'filters', 'folders', 'sort'
  const dropdownRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load media when tab, page, or sort changes
  useEffect(() => {
    fetchMedia({
      type: activeTab === 'ALL' ? null : activeTab,
      page: currentPage,
      sort: sortBy,
      folderId: selectedFolder,
      search: searchQuery.length > 2 ? searchQuery : null
    });
  }, [activeTab, currentPage, sortBy, selectedFolder, searchQuery, fetchMedia]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadMedia(file, selectedFolder);
      setSelectedItem(uploaded);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      try {
        await createFolder(newFolderName.trim());
        setNewFolderName('');
        setShowFolderModal(false);
      } catch (err) {
        alert('Failed to create folder');
      }
    }
  };

  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <div className="media-page fade-in">
      {/* Header Section */}
      <div className="media-header-section">
        <div className="media-header-top">
          <div className="media-header-info">
            <h1>Media Library</h1>
            <p>Manage your assets for WhatsApp templates and broadcasts</p>
          </div>
          <div className="media-header-actions">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <FileUp size={16} />
              <span>Upload Media</span>
              <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading} />
            </label>
            <Button variant="primary" onClick={() => setShowFolderModal(true)}>
              <Plus size={16} />
              <span>New Folder</span>
            </Button>
          </div>
        </div>

        <div className="media-tabs">
          {MEDIA_TABS.map(tab => (
            <div 
              key={tab.id}
              className={`media-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar Section */}
      <div className="media-toolbar" ref={dropdownRef}>
        <div className="media-toolbar-left">
          <div className="media-search-container">
            <Search className="media-search-icon" size={16} />
            <input 
              className="media-search-input"
              type="text"
              placeholder="Search media by name, tag, campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Filters Dropdown */}
          <div className="dropdown-wrapper">
            <div className={`toolbar-dropdown ${activeDropdown === 'filters' ? 'active' : ''}`} onClick={() => toggleDropdown('filters')}>
              <Filter size={14} />
              <span>Filters</span>
              <ChevronDown size={14} />
            </div>
            {activeDropdown === 'filters' && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { setActiveTab('ALL'); setActiveDropdown(null); }}>
                  <span>Show All</span>
                  {activeTab === 'ALL' && <Check size={14} />}
                </div>
                <div className="dropdown-divider" />
                <div className="dropdown-header">By Status</div>
                <div className="dropdown-item">
                  <span>Archived Only</span>
                </div>
              </div>
            )}
          </div>

          {/* Folders Dropdown */}
          <div className="dropdown-wrapper">
            <div className={`toolbar-dropdown ${activeDropdown === 'folders' ? 'active' : ''}`} onClick={() => toggleDropdown('folders')}>
              <Folder size={14} />
              <span>{selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'All Folders'}</span>
              <ChevronDown size={14} />
            </div>
            {activeDropdown === 'folders' && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { setSelectedFolder(null); setActiveDropdown(null); }}>
                  <span>All Assets</span>
                  {!selectedFolder && <Check size={14} />}
                </div>
                <div className="dropdown-divider" />
                {folders.map(f => (
                  <div key={f.id} className="dropdown-item" onClick={() => { setSelectedFolder(f.id); setActiveDropdown(null); }}>
                    <span>{f.name}</span>
                    {selectedFolder === f.id && <Check size={14} />}
                  </div>
                ))}
                {folders.length === 0 && <div className="dropdown-item text-muted">No folders created</div>}
              </div>
            )}
          </div>
        </div>

        <div className="media-toolbar-right">
          {/* Sort Dropdown */}
          <div className="dropdown-wrapper">
            <div className={`toolbar-dropdown ${activeDropdown === 'sort' ? 'active' : ''}`} onClick={() => toggleDropdown('sort')}>
              <ArrowUpDown size={14} />
              <span>Sort: {SORT_OPTIONS.find(o => o.id === sortBy)?.label || 'Latest'}</span>
              <ChevronDown size={14} />
            </div>
            {activeDropdown === 'sort' && (
              <div className="dropdown-menu right">
                {SORT_OPTIONS.map(opt => (
                  <div key={opt.id} className="dropdown-item" onClick={() => { setSortBy(opt.id); setActiveDropdown(null); }}>
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <Check size={14} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="view-controls" style={{ background: 'var(--bg-input)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '2px' }}>
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              style={{ border: 'none', background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent', padding: '6px', borderRadius: '6px', color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              <Grid size={18} />
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ border: 'none', background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent', padding: '6px', borderRadius: '6px', color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="media-content-container">
        <div className="media-main-scroll">
          <div className="media-stats-line">
            <h2>All Media</h2>
            <div className="media-count-badge">{pagination.total} Assets</div>
          </div>

          {loading && media.length === 0 ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 className="spin" size={40} style={{ color: 'var(--accent)' }} />
            </div>
          ) : media.length === 0 ? (
            <EmptyState
              icon={FileIcon}
              title="No assets found"
              description="Upload your first marketing asset to get started."
            />
          ) : (
            <div className="media-grid">
              {media.map((item) => (
                <div 
                  key={item.id} 
                  className={`media-card ${selectedItem?.id === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="card-preview-area">
                    {item.type === 'IMAGE' ? (
                      <img src={item.url} alt={item.filename} loading="lazy" />
                    ) : (
                      <div className="file-icon-placeholder" style={{ color: 'var(--text-muted)' }}>
                        {item.type === 'VIDEO' ? <VideoIcon size={48} /> :
                         item.type === 'AUDIO' ? <AudioIcon size={48} /> :
                         <FileIcon size={48} />}
                      </div>
                    )}
                    <div className="card-type-badge">{item.type}</div>
                    <button 
                      className="card-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  <div className="card-details">
                    <div className="card-filename" title={item.filename}>{item.filename}</div>
                    <div className="card-tags">
                      {item.tags?.slice(0, 2).map(tag => (
                        <Chip key={tag} label={tag} status="default" className="text-xs" />
                      ))}
                      {item.tags?.length > 2 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{item.tags.length - 2}</span>}
                    </div>
                    <div className="card-meta-line">
                      <span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>{(item.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <div className="card-usage-line">
                      <Link2 size={12} />
                      <span>Used in {item.usageCount || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="media-pagination">
            {pagination.pages > 1 && (
              <div className="pagination-pages">
                <button 
                  className="page-btn" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                {[...Array(pagination.pages)].map((_, i) => (
                  <button 
                    key={i} 
                    className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  className="page-btn" 
                  disabled={currentPage === pagination.pages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <div className="pagination-info">
              Showing {pagination.total > 0 ? (currentPage - 1) * pagination.limit + 1 : 0} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} assets
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar and Modals */}
      {selectedItem && (
        <>
          <div className="sidebar-overlay" onClick={() => setSelectedItem(null)} />
          <MediaDetailsSidebar 
            item={selectedItem} 
            onClose={() => setSelectedItem(null)} 
          />
        </>
      )}

      {showFolderModal && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>Create New Folder</h3>
              <button className="close-btn" onClick={() => setShowFolderModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Folder Name</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Marketing, Campaigns, etc."
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button variant="secondary" onClick={() => setShowFolderModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Create Folder</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
