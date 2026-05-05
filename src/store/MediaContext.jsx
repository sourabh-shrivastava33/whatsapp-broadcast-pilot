import config from '../config.js';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const MediaContext = createContext();

export function MediaProvider({ children }) {
  const [media, setMedia] = useState([]);
  const [folders, setFolders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMedia = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 20,
        sort: params.sort || 'desc',
        ...(params.type && { type: params.type }),
        ...(params.campaign && { campaign: params.campaign }),
        ...(params.folderId && { folderId: params.folderId }),
        ...(params.archived !== undefined && { archived: params.archived }),
      });

      const response = await fetch(`${config.API_URL}/media?${query}`);
      if (!response.ok) throw new Error('Failed to fetch media');
      const result = await response.json();
      setMedia(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || { total: 0, page: 1, limit: 20, pages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch(`${config.API_URL}/folders`);
      if (!response.ok) throw new Error('Failed to fetch folders');
      const data = await response.json();
      setFolders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Folder fetch error:', err);
    }
  }, []);

  const createFolder = async (name, parentId = null) => {
    try {
      const response = await fetch(`${config.API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      });
      if (!response.ok) throw new Error('Folder creation failed');
      const newFolder = await response.json();
      setFolders(prev => [...prev, newFolder]);
      return newFolder;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const uploadMedia = async (file, folderId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);

    try {
      const response = await fetch(`${config.API_URL}/media/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const newMedia = await response.json();
      
      setMedia(prev => {
        const exists = prev.find(m => m.id === newMedia.id);
        if (exists) return prev;
        return [newMedia, ...prev];
      });
      
      return newMedia;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateMedia = async (id, data) => {
    try {
      const response = await fetch(`${config.API_URL}/media/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Update failed');
      const updated = await response.json();
      setMedia(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const duplicateMedia = async (id) => {
    try {
      const response = await fetch(`${config.API_URL}/media/${id}/duplicate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Duplication failed');
      const copy = await response.json();
      setMedia(prev => [copy, ...prev]);
      return copy;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const moveMedia = async (id, folderId) => {
    try {
      const response = await fetch(`${config.API_URL}/media/${id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      if (!response.ok) throw new Error('Move failed');
      const updated = await response.json();
      setMedia(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const archiveMedia = async (id) => {
    try {
      const response = await fetch(`${config.API_URL}/media/${id}/archive`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Archive failed');
      const updated = await response.json();
      setMedia(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteMedia = async (id) => {
    try {
      const response = await fetch(`${config.API_URL}/media/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
      setMedia(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const fetchUsage = async (id) => {
    try {
      const response = await fetch(`${config.API_URL}/media/${id}/usage`);
      if (!response.ok) throw new Error('Failed to fetch usage');
      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchMedia();
    fetchFolders();
  }, [fetchMedia, fetchFolders]);

  return (
    <MediaContext.Provider value={{ 
      media, 
      folders,
      pagination,
      loading, 
      error, 
      fetchMedia, 
      fetchFolders,
      createFolder,
      uploadMedia, 
      updateMedia, 
      duplicateMedia,
      moveMedia,
      archiveMedia, 
      deleteMedia,
      fetchUsage
    }}>
      {children}
    </MediaContext.Provider>
  );
}

export const useMedia = () => useContext(MediaContext);
