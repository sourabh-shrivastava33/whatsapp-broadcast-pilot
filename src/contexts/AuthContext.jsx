import React, { createContext, useContext, useState, useEffect } from 'react';
import config from '../config.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${config.API_URL}/auth/me`, { 
        headers,
        credentials: 'include' 
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        await fetchWorkspaces();
      } else {
        setUser(null);
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${config.API_URL}/auth/workspaces`, { 
        headers,
        credentials: 'include' 
      });
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
        if (data.length > 0 && !activeWorkspace) {
          const savedId = localStorage.getItem('activeWorkspaceId');
          const saved = data.find(w => w.id === savedId);
          const selected = saved || data[0];
          setActiveWorkspace(selected);
          setUserRole(selected?.role || null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  };

  const selectWorkspace = (workspace) => {
    setActiveWorkspace(workspace);
    setUserRole(workspace?.role || null);
    if (workspace) {
      localStorage.setItem('activeWorkspaceId', workspace.id);
    } else {
      localStorage.removeItem('activeWorkspaceId');
    }
  };

  const login = async (email, password) => {
    const response = await fetch(`${config.API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (response.ok) {
      const { user: userData, token } = await response.json();
      localStorage.setItem('token', token);
      setUser(userData);
      await fetchWorkspaces();
      return { success: true };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const register = async (email, password, name) => {
    const response = await fetch(`${config.API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });

    if (response.ok) {
      const { user: userData, token } = await response.json();
      localStorage.setItem('token', token);
      setUser(userData);
      await fetchWorkspaces();
      return { success: true };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const createWorkspace = async (name) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${config.API_URL}/auth/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
      credentials: 'include',
    });

    if (response.ok) {
      const workspace = await response.json();
      setWorkspaces(prev => [...prev, workspace]);
      setActiveWorkspace(workspace);
      localStorage.setItem('activeWorkspaceId', workspace.id);
      return { success: true, workspace };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const logout = async () => {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`${config.API_URL}/auth/logout`, { 
      method: 'POST', 
      headers,
      credentials: 'include' 
    });
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    localStorage.removeItem('activeWorkspaceId');
    localStorage.removeItem('token');
  };

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      ...options.headers,
    };
    if (activeWorkspace) {
      headers['X-Workspace-Id'] = activeWorkspace.id;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { 
      ...options, 
      headers,
      credentials: 'include' 
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      workspaces, 
      activeWorkspace, 
      userRole,
      loading, 
      login, 
      register, 
      logout, 
      selectWorkspace,
      createWorkspace,
      authFetch 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
