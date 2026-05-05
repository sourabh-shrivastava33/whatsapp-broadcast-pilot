import config from '../config.js';
/**
 * TemplatesContext — manages WhatsApp message templates.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { useAuth } from '../contexts/AuthContext';

const TemplatesContext = createContext(null);
const API_URL = config.API_URL + "/templates";

const INITIAL_STATE = { templates: [], loading: true };

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true };
    case "SET_TEMPLATES":
      return { ...state, templates: action.payload, loading: false };
    case "ADD_TEMPLATE":
      return { ...state, templates: [...state.templates, action.payload] };
    case "UPDATE_TEMPLATE":
    case "SET_STATUS": {
      const templates = state.templates.map((t) =>
        t.id === action.payload.id ? { ...t, ...action.payload } : t,
      );
      return { ...state, templates };
    }
    case "DELETE_TEMPLATE": {
      const templates = state.templates.filter(
        (t) => t.id !== action.payload.id,
      );
      return { ...state, templates };
    }
    default:
      return state;
  }
}

export function TemplatesProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { authFetch, activeWorkspace } = useAuth();

  const fetchTemplates = useCallback(async () => {
    if (!activeWorkspace) return;
    dispatch({ type: "SET_LOADING" });
    try {
      const res = await authFetch(API_URL);
      const data = await res.json();
      dispatch({ type: "SET_TEMPLATES", payload: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error("Failed to fetch templates", err);
      dispatch({ type: "SET_TEMPLATES", payload: [] });
    }
  }, [authFetch, activeWorkspace]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const actions = {
    addTemplate: async (payload) => {
      try {
        const res = await authFetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        dispatch({ type: "ADD_TEMPLATE", payload: data });
        return data;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },

    updateTemplate: async (payload) => {
      try {
        const res = await authFetch(`${API_URL}/${payload.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        dispatch({ type: "UPDATE_TEMPLATE", payload: data });
      } catch (err) {
        console.error(err);
      }
    },

    deleteTemplate: async (id) => {
      try {
        await authFetch(`${API_URL}/${id}`, { method: "DELETE" });
        dispatch({ type: "DELETE_TEMPLATE", payload: { id } });
      } catch (err) {
        console.error(err);
      }
    },

    setTemplateStatus: async (id, status) => {
      try {
        const res = await authFetch(`${API_URL}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await res.json();
        dispatch({ type: "SET_STATUS", payload: data });
      } catch (err) {
        console.error(err);
      }
    },

    submitTemplateForApproval: async (id) => {
      try {
        const res = await authFetch(`${API_URL}/${id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        
        if (!res.ok || data.error) {
          const detailMsg = data.details ? `\n- ${data.details.join('\n- ')}` : '';
          throw new Error(data.error + detailMsg);
        }

        await fetchTemplates();
        return data;
      } catch (err) {
        console.error("Submission Error Details:", err);
        throw err;
      }
    },

    syncTemplates: async () => {
      try {
        const res = await authFetch(
          config.API_URL + "/meta/sync-templates",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        await fetchTemplates();
        return data;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  };

  return (
    <TemplatesContext.Provider value={{ state, ...actions }}>
      {children}
    </TemplatesContext.Provider>
  );
}

export function useTemplates() {
  const ctx = useContext(TemplatesContext);
  if (!ctx) throw new Error("useTemplates must be inside TemplatesProvider");
  return {
    ...ctx,
    templates: ctx.state.templates,
    loading: ctx.state.loading,
  };
}
