const isProd = import.meta.env.PROD;
const VITE_API_URL = import.meta.env.VITE_API_URL;

// For API calls, we prefer relative paths to leverage Vite/Vercel proxies
// This avoids CORS issues and simplifies local development.
const API_BASE_URL = VITE_API_URL || ''; 

// Socket.io requires an absolute URL in production because Vercel doesn't proxy WebSockets
const SOCKET_URL = VITE_API_URL || (isProd ? 'https://whatsapp-broadcast-pilot.onrender.com' : 'http://localhost:10000');

export const config = {
  API_BASE_URL,
  API_URL: `${API_BASE_URL}/api`,
  SOCKET_URL,
};

export default config;
