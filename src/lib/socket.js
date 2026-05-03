import { io } from "socket.io-client";
import { config } from "../config";

const SOCKET_URL = config.SOCKET_URL;

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
});

const disconnectSocket = () => {
  if (socket & (socket.connected == true)) {
    socket.close();
  }
};
const connectSocket = () => {
  if (socket & (socket.connected == false)) {
    socket.connect();
  }
};

window.addEventListener("pagehide", (event) => {
  disconnectSocket();
});
window.addEventListener("pageshow", (event) => {
  connectSocket();
});

// Debugging
socket.on("connect", () => {
  console.log("✅ Connected to Real-time Sync Server");
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from Real-time Sync Server");
});
