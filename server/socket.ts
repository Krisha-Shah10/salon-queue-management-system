import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setupSocketIO(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet');
  }
  return ioInstance;
}
