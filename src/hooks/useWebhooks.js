import config from '../config.js';
import { useState, useEffect, useCallback } from 'react';
import { socket } from '../lib/socket';
import { useToast } from '../store/ToastContext';

const API_BASE = config.API_URL;

export function useWebhooks() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    url: 'https://whatsapp-broadcast-pilot.onrender.com/api/webhooks',
    verifyToken: 'whatsapp_broadcast_crm_token',
    subscriptions: 'messages,statuses',
    isActive: true,
    healthStatus: 'unknown',
    metaStatus: 'unknown',
    metaError: null,
    lastSyncAt: null
  });
  
  const [systemHealth, setSystemHealth] = useState({ status: 'unknown', details: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/webhook-settings`);
      const data = await res.json();
      setSettings(data && typeof data === 'object' ? data : {
        url: 'https://whatsapp-broadcast-pilot.onrender.com/api/webhooks',
        verifyToken: 'whatsapp_broadcast_crm_token',
        subscriptions: 'messages,statuses',
        isActive: true,
        healthStatus: 'unknown',
        metaStatus: 'unknown',
        metaError: null,
        lastSyncAt: null
      });
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch settings', err);
      setLoading(false);
    }
  }, []);

  const fetchSystemHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/health`);
      const data = await res.json();
      setSystemHealth(data);
    } catch (err) {
      console.error('Failed to fetch system health', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSystemHealth();

    const handleSyncUpdate = (data) => {
      setSyncProgress(data);
      if (data.status === 'success') {
        toast({ type: 'success', title: 'Meta Sync', message: data.message });
        fetchSettings();
        setSyncProgress(null);
      } else if (data.status === 'error') {
        toast({ type: 'error', title: 'Sync Error', message: data.message });
        setSyncProgress(null);
        fetchSettings();
      }
    };

    socket.on('sync_status', handleSyncUpdate);
    return () => socket.off('sync_status', handleSyncUpdate);
  }, [fetchSettings, fetchSystemHealth, toast]);

  const saveSettings = async (newSettings) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/webhook-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...(newSettings || settings), 
          url: 'https://whatsapp-broadcast-pilot.onrender.com/api/webhooks' 
        })
      });
      const data = await res.json();
      setSettings(data);
      toast({ type: 'success', title: 'Saved', message: 'Settings updated locally.' });
      return data;
    } catch (err) {
      toast({ type: 'error', title: 'Save Failed', message: err.message });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    toast({ type: 'loading', message: 'Testing connection...' });
    try {
      const res = await fetch(`${API_BASE}/webhook-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: 'https://whatsapp-broadcast-pilot.onrender.com/api/webhooks', 
          verifyToken: settings.verifyToken 
        })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setSettings(prev => ({ ...prev, healthStatus: 'healthy' }));
        toast({ type: 'success', title: 'Healthy', message: 'Webhook verified!' });
      } else {
        setSettings(prev => ({ ...prev, healthStatus: 'failing' }));
        toast({ type: 'error', title: 'Failing', message: data.message });
      }
      return data;
    } catch (err) {
      const result = { success: false, message: err.message };
      setTestResult(result);
      toast({ type: 'error', title: 'Test Error', message: err.message });
      return result;
    } finally {
      setTesting(false);
      fetchSystemHealth();
    }
  };

  const syncToMeta = async () => {
    setSaving(true);
    setSyncProgress({ status: 'processing', message: 'Starting synchronization...' });
    try {
      const res = await fetch(`${API_BASE}/webhook-settings/meta-sync`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Sync failed');
      return data;
    } catch (err) {
      // Error handled by socket listener too
      setSaving(false);
      throw err;
    }
  };

  const toggleSubscription = useCallback((field) => {
    setSettings(prev => {
      const subs = (prev.subscriptions || '').split(',').filter(Boolean);
      const newSubs = subs.includes(field) 
        ? subs.filter(s => s !== field) 
        : [...subs, field];
      
      return { ...prev, subscriptions: newSubs.join(',') };
    });
  }, []);

  return {
    settings,
    setSettings,
    systemHealth,
    loading,
    saving,
    testing,
    testResult,
    syncProgress,
    saveSettings,
    testConnection,
    syncToMeta,
    toggleSubscription,
    refresh: fetchSettings
  };
}
