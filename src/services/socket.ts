import { io, Socket } from 'socket.io-client';

// Connect to explicit backend URL (e.g. Render) or same-origin in local dev
const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || undefined;

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected to Salon Queue WebSocket server (ID:', socket.id, ')');
});

socket.on('disconnect', () => {
  console.log('Disconnected from Salon Queue WebSocket server');
});
