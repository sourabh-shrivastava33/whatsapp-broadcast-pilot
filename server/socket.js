import { Server } from "socket.io";

let io;

export function initSocket(httpServer, options) {
  io = new Server(httpServer, options);
  return io;
}

export function getIO() {
  if (!io) {
    // Return a mock or handle the case where it's not init yet
    console.warn("Socket.io not initialized yet!");
  }
  return io;
}
