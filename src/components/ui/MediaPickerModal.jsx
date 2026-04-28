import React, { useState } from 'react';
import { useMedia } from '../../store/MediaContext';
import { X, Search, Image as ImageIcon, Video as VideoIcon, Music as AudioIcon, FileText as FileIcon, Loader2 } from 'lucide-react';
import { Button } from './Button';

export function MediaPickerModal({ isOpen, onClose, onSelect, type }) {
  const { media, loading } = useMedia();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredMedia = media.filter(m => 
    (type === 'ALL' || m.type === type) && 
    (m.filename.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Select Media</h2>
            <p className="text-sm text-slate-400">Choose a file from your media library</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-slate-400">Loading library...</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4">
                <ImageIcon className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-slate-400">No media found matching your criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredMedia.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="group relative aspect-square bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500 transition-all shadow-sm"
                >
                  {item.type === 'IMAGE' ? (
                    <img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {item.type === 'VIDEO' ? <VideoIcon className="h-8 w-8 text-blue-500" /> :
                       item.type === 'AUDIO' ? <AudioIcon className="h-8 w-8 text-purple-500" /> :
                       <FileIcon className="h-8 w-8 text-slate-500" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium">Select</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-slate-950/80 to-transparent">
                    <p className="text-[10px] text-white truncate font-medium">{item.filename}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
