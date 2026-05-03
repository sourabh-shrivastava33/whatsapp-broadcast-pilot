import config from '../config.js';
import React, { createContext, useContext, useState, useEffect } from 'react';

const MediaContext = createContext();

export function MediaProvider({ children }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const response = await fetch(config.API_URL + "/media");
      if (!response.ok) throw new Error('Failed to fetch media');
      const data = await response.json();
      setMedia(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${config.API_URL}/media/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const newMedia = await response.json();
      setMedia((prev) => [newMedia, ...prev]);
      return newMedia;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  return (
    <MediaContext.Provider value={{ media, loading, error, fetchMedia, uploadMedia }}>
      {children}
    </MediaContext.Provider>
  );
}

export const useMedia = () => useContext(MediaContext);
