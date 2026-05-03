import config from './config.js';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';

export const config = {
  API_BASE_URL,
  API_URL: `${API_BASE_URL}/api`,
  SOCKET_URL: API_BASE_URL,
};

export default config;
