import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});

// Debugging
socket.on('connect', () => {
  console.log('✅ Connected to Real-time Sync Server');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from Real-time Sync Server');
});
