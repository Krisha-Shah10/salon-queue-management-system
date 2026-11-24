import { io, Socket } from 'socket.io-client';

// Connect to current origin in production or proxy in dev
export const socket: Socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('Connected to Salon Queue WebSocket server (ID:', socket.id, ')');
});

socket.on('disconnect', () => {
  console.log('Disconnected from Salon Queue WebSocket server');
});
