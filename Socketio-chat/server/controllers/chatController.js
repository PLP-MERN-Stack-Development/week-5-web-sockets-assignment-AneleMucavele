const User = require('../models/User');
const messageHistory = [];
const MESSAGE_LIMIT = 100;

let typingUsers = new Set();

function setupChatSocket(io, socket) {
  socket.on('message', (msg) => {
    io.emit('message', msg);
  });

  socket.on('typing', (username) => {
    typingUsers.add(username);
    io.emit('typing', Array.from(typingUsers));
    
    setTimeout(() => {
      typingUsers.delete(username);
      io.emit('typing', Array.from(typingUsers));
    }, 3000);
  });
}

 socket.on('privateMessage', ({ to, text }) => {
    const fromUser = User.getUser(socket.id);
    if (!fromUser) return;

    const toSocket = Array.from(io.sockets.sockets.values())
      .find(s => User.getUser(s.id)?.username === to);
    
    if (toSocket) {
      const message = {
        from: fromUser.username,
        to,
        text,
        time: new Date().toISOString()
      };
      
      toSocket.emit('privateMessage', message);
      socket.emit('privateMessage', message);
    }
  });

   socket.on('joinRoom', (room, callback) => {
    socket.rooms.forEach(r => {
      if (r !== socket.id) socket.leave(r);
    });
    
    socket.join(room);
    callback(null, `Joined room: ${room}`);
  });

  socket.on('roomMessage', ({ room, text }) => {
    const user = User.getUser(socket.id);
    if (!user) return;

    const message = {
      username: user.username,
      text,
      time: new Date().toISOString(),
      room
    };

    io.to(room).emit('roomMessage', message);
  });

   socket.on('getHistory', (room, callback) => {
    const roomMessages = room 
      ? messageHistory.filter(m => m.room === room)
      : messageHistory.filter(m => !m.room);
    
    callback(roomMessages.slice(-50)); // Return last 50 messages
  });

  // Update message handlers to store history
  function storeMessage(msg) {
    messageHistory.push(msg);
    if (messageHistory.length > MESSAGE_LIMIT) {
      messageHistory.shift();
    }
  }

  socket.on('message', (msg) => {
    storeMessage(msg);
    io.emit('message', msg);
  });

  socket.on('roomMessage', ({ room, text }) => {
    const user = User.getUser(socket.id);
    if (!user) return;

    const message = {
      username: user.username,
      text,
      time: new Date().toISOString(),
      room
    };

    storeMessage(message);
    io.to(room).emit('roomMessage', message);
  });

module.exports = setupChatSocket;