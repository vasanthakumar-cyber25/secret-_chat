const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  maxHttpBufferSize: 1e7 // 10MB limit for image/audio sharing
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // Chat/Media messages relay
  socket.on('send-message', (data) => {
    socket.to(data.roomId).emit('receive-message', data);
  });

  // WebRTC Audio Call Signals
  socket.on('call-user', (data) => {
    socket.to(data.roomId).emit('call-made', { signal: data.signal, from: socket.id });
  });

  socket.on('make-answer', (data) => {
    socket.to(data.roomId).emit('answer-made', { signal: data.signal });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', data.candidate);
  });

  socket.on('end-call', (roomId) => {
    socket.to(roomId).emit('call-ended');
  });

  socket.on('disconnect', () => {
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));