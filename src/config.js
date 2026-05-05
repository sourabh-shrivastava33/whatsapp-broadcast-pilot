const isProd = import.meta.env.PROD;
const VITE_API_URL = import.meta.env.VITE_API_URL;

// Default to production Render URL if in production and no env var provided
// Default to localhost:10000 if in development
const API_BASE_URL = VITE_API_URL || (isProd ? 'https://whatsapp-broadcast-pilot.onrender.com' : 'http://localhost:10000');

export const config = {
  API_BASE_URL,
  API_URL: `${API_BASE_URL}/api`,
  SOCKET_URL: API_BASE_URL,
};

export default config;
