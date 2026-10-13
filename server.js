'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Must be large enough for the demo's base64 image/audio payloads.
  // Prefer uploading media to storage for a production application.
  maxHttpBufferSize: 10 * 1024 * 1024
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join-room', (rawRoomId) => {
    if (typeof rawRoomId !== 'string') return;
    const roomId = rawRoomId.trim();
    if (!roomId || roomId.length > 100) return;

    // A socket can be in only one app room at a time.
    const oldRoom = socket.data.roomId;
    if (oldRoom && oldRoom !== roomId) {
      socket.to(oldRoom).emit('user-disconnected', socket.id);
      socket.leave(oldRoom);
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.to(roomId).emit('user-connected', socket.id);
    socket.emit('room-joined', { roomId, socketId: socket.id });
  });

  socket.on('send-message', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { roomId, data, type } = payload;
    if (
      typeof roomId !== 'string' ||
      roomId !== socket.data.roomId ||
      typeof data !== 'string' ||
      !['text', 'image', 'audio'].includes(type)
    ) return;

    socket.to(roomId).emit('receive-message', {
      roomId,
      data,
      type,
      from: socket.id,
      sentAt: Date.now()
    });
  });

  socket.on('call-user', (payload) => {
    if (!payload || payload.roomId !== socket.data.roomId || !payload.signal) return;
    socket.to(payload.roomId).emit('call-made', {
      signal: payload.signal,
      from: socket.id
    });
  });

  socket.on('make-answer', (payload) => {
    if (!payload || payload.roomId !== socket.data.roomId || !payload.signal) return;
    socket.to(payload.roomId).emit('answer-made', {
      signal: payload.signal,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (payload) => {
    if (!payload || payload.roomId !== socket.data.roomId || !payload.candidate) return;
    socket.to(payload.roomId).emit('ice-candidate', {
      candidate: payload.candidate,
      from: socket.id
    });
  });

  socket.on('end-call', (roomId) => {
    if (typeof roomId === 'string' && roomId === socket.data.roomId) {
      socket.to(roomId).emit('call-ended', { from: socket.id });
    }
  });

  socket.on('leave-room', (roomId) => {
    const currentRoom = socket.data.roomId;
    if (!currentRoom || (roomId && roomId !== currentRoom)) return;

    socket.to(currentRoom).emit('user-disconnected', socket.id);
    socket.leave(currentRoom);
    delete socket.data.roomId;
    socket.emit('room-left');
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('user-disconnected', socket.id);
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Secret Chat server running at http://localhost:${PORT}`);
});
