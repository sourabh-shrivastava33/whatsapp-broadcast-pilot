/**
 * TemplatesContext — manages WhatsApp message templates.
 */
import React, { createContext, useContext, useReducer, useEffect } from "react";

const TemplatesContext = createContext(null);
const API_URL = "http://localhost:3001/api/templates";

const INITIAL_STATE = { templates: [] };

function reducer(state, action) {
  switch (action.type) {
    case "SET_TEMPLATES":
      return { ...state, templates: action.payload };
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

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => dispatch({ type: "SET_TEMPLATES", payload: data }))
      .catch((err) => console.error("Failed to fetch templates", err));
  }, []);

  return (
    <TemplatesContext.Provider value={{ state, dispatch }}>
      {children}
    </TemplatesContext.Provider>
  );
}

export function useTemplates() {
  const ctx = useContext(TemplatesContext);
  if (!ctx) throw new Error("useTemplates must be inside TemplatesProvider");
  const { state, dispatch } = ctx;

  return {
    templates: state.templates,

    addTemplate: async (payload) => {
      try {
        const res = await fetch(API_URL, {
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
        const res = await fetch(`${API_URL}/${payload.id}`, {
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
        await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        dispatch({ type: "DELETE_TEMPLATE", payload: { id } });
      } catch (err) {
        console.error(err);
      }
    },

    setTemplateStatus: async (id, status) => {
      try {
        const res = await fetch(`${API_URL}/${id}`, {
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
        const res = await fetch(`${API_URL}/${id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Refetch all templates as multiple account-specific ones were created
        const allRes = await fetch(API_URL);
        const allData = await allRes.json();
        dispatch({ type: "SET_TEMPLATES", payload: allData });

        return data;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },

    syncTemplates: async () => {
      try {
        const res = await fetch(
          "http://localhost:3001/api/meta/sync-templates",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Refetch all templates to update the UI
        const allRes = await fetch(API_URL);
        const allData = await allRes.json();
        dispatch({ type: "SET_TEMPLATES", payload: allData });

        return data;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  };
}
