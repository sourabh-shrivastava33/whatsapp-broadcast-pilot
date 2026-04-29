import React, { useState } from 'react';
import { useMedia } from '../../store/MediaContext';
import { X, Search, Image as ImageIcon, Video as VideoIcon, Music as AudioIcon, FileText as FileIcon, Loader2 } from 'lucide-react';
import { Button } from './Button';
import './MediaPickerModal.css';

export function MediaPickerModal({ isOpen, onClose, onSelect, type }) {
  const { media, loading } = useMedia();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredMedia = media.filter(m => 
    (type === 'ALL' || m.type === type) && 
    (m.filename.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="media-picker-overlay">
      <div className="media-picker-container">
        {/* Header */}
        <div className="media-picker-header">
          <div>
            <h2>Select Media</h2>
            <p>Choose a file from your media library</p>
          </div>
          <button onClick={onClose} className="media-picker-close">
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="media-picker-filters">
          <div className="media-search-wrapper">
            <Search size={16} className="media-search-icon" />
            <input 
              type="text"
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="media-search-input"
            />
          </div>
        </div>

        {/* Content */}
        <div className="media-picker-content">
          {loading ? (
            <div className="media-loader">
              <Loader2 className="spin" size={32} />
              <p>Loading library...</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="media-empty">
              <div className="media-empty-icon">
                <ImageIcon size={24} />
              </div>
              <p>No media found matching your criteria</p>
            </div>
          ) : (
            <div className="media-grid">
              {filteredMedia.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="media-item-card"
                >
                  {item.type === 'IMAGE' ? (
                    <img src={item.url} alt={item.filename} className="media-thumbnail" />
                  ) : (
                    <div className="media-icon-placeholder">
                      {item.type === 'VIDEO' ? <VideoIcon size={32} /> :
                       item.type === 'AUDIO' ? <AudioIcon size={32} /> :
                       <FileIcon size={32} />}
                    </div>
                  )}
                  <div className="media-item-overlay">
                    <span>Select</span>
                  </div>
                  <div className="media-item-info">
                    <p className="media-item-filename">{item.filename}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="media-picker-footer">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
