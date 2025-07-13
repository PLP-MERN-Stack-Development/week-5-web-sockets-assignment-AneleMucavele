require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Initialize Express app
const app = express();
app.use(cors());
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// User management
class UserManager {
  constructor() {
    this.users = new Map(); // socket.id -> user data
    this.typingUsers = new Map(); // username -> room
  }

  addUser(socketId, username) {
    const user = {
      username,
      online: true,
      lastSeen: new Date(),
      rooms: new Set(['general']),
      socketId
    };
    this.users.set(socketId, user);
    return user;
  }

  getUser(socketId) {
    return this.users.get(socketId);
  }

  getUserByUsername(username) {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  removeUser(socketId) {
    const user = this.getUser(socketId);
    if (user) {
      this.users.delete(socketId);
      // Remove any typing indicators
      this.typingUsers.forEach((_, key) => {
        if (key.startsWith(user.username)) {
          this.typingUsers.delete(key);
        }
      });
    }
    return user;
  }

  getAllUsers() {
    return Array.from(this.users.values()).map(user => ({
      username: user.username,
      online: user.online,
      lastSeen: user.lastSeen,
      rooms: Array.from(user.rooms)
    }));
  }

  addTypingUser(username, room) {
    const key = `${username}-${room}`;
    this.typingUsers.set(key, { username, room });
    return this.getTypingUsers(room);
  }

  removeTypingUser(username, room) {
    const key = `${username}-${room}`;
    this.typingUsers.delete(key);
    return this.getTypingUsers(room);
  }

  getTypingUsers(room) {
    return Array.from(this.typingUsers.values())
      .filter(user => user.room === room)
      .map(user => user.username);
  }
}

const userManager = new UserManager();

// Message storage
class MessageStore {
  constructor() {
    this.messages = new Map(); // room -> messages[]
    this.privateMessages = new Map(); // userPair -> messages[]
  }

  addMessage(room, message) {
    if (!this.messages.has(room)) {
      this.messages.set(room, []);
    }
    this.messages.get(room).push(message);
  }

  addPrivateMessage(sender, receiver, message) {
    const key = [sender, receiver].sort().join('-');
    if (!this.privateMessages.has(key)) {
      this.privateMessages.set(key, []);
    }
    this.privateMessages.get(key).push(message);
  }

  getMessages(room, limit = 50) {
    return this.messages.get(room)?.slice(-limit) || [];
  }

  getPrivateMessages(user1, user2, limit = 50) {
    const key = [user1, user2].sort().join('-');
    return this.privateMessages.get(key)?.slice(-limit) || [];
  }
}

const messageStore = new MessageStore();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Authentication
  socket.on('login', (username, callback) => {
    try {
      if (!username || typeof username !== 'string' || username.length < 3) {
        return callback({ error: 'Username must be at least 3 characters' });
      }

      if (userManager.getUserByUsername(username)) {
        return callback({ error: 'Username already taken' });
      }

      const user = userManager.addUser(socket.id, username);
      socket.join('general');

      // Notify all users
      io.emit('user:list', userManager.getAllUsers());
      io.emit('notification', {
        type: 'user:joined',
        username: user.username,
        timestamp: new Date().toISOString()
      });

      // Send initial data
      callback({
        success: true,
        user: {
          username: user.username,
          rooms: Array.from(user.rooms)
        },
        messages: messageStore.getMessages('general')
      });
    } catch (err) {
      console.error('Login error:', err);
      callback({ error: 'Internal server error' });
    }
  });

  // Message handling
  socket.on('message:send', ({ room, text }, callback) => {
    try {
      const user = userManager.getUser(socket.id);
      if (!user) return callback({ error: 'Unauthorized' });

      const message = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        from: user.username,
        text,
        timestamp: new Date().toISOString(),
        room
      };

      if (room.startsWith('private-')) {
        const recipient = room.replace('private-', '');
        messageStore.addPrivateMessage(user.username, recipient, message);
        
        const recipientUser = userManager.getUserByUsername(recipient);
        if (recipientUser) {
          socket.to(recipientUser.socketId).emit('message:new', message);
        }
      } else {
        messageStore.addMessage(room, message);
        io.to(room).emit('message:new', message);
      }

      callback({ success: true, message });
    } catch (err) {
      console.error('Message error:', err);
      callback({ error: 'Failed to send message' });
    }
  });

  // Room management
  socket.on('room:join', (room, callback) => {
    try {
      const user = userManager.getUser(socket.id);
      if (!user) return callback({ error: 'Unauthorized' });

      if (room !== 'general' && !user.rooms.has(room)) {
        socket.join(room);
        user.rooms.add(room);
      }

      callback({
        success: true,
        room,
        messages: room.startsWith('private-') 
          ? messageStore.getPrivateMessages(user.username, room.replace('private-', ''))
          : messageStore.getMessages(room)
      });

      io.emit('user:list', userManager.getAllUsers());
    } catch (err) {
      console.error('Room join error:', err);
      callback({ error: 'Failed to join room' });
    }
  });

  // Typing indicator
  socket.on('typing:start', (room) => {
    const user = userManager.getUser(socket.id);
    if (user) {
      const typingUsers = userManager.addTypingUser(user.username, room);
      io.to(room).emit('typing:update', typingUsers);
    }
  });

  socket.on('typing:stop', (room) => {
    const user = userManager.getUser(socket.id);
    if (user) {
      const typingUsers = userManager.removeTypingUser(user.username, room);
      io.to(room).emit('typing:update', typingUsers);
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    const user = userManager.removeUser(socket.id);
    if (user) {
      io.emit('user:list', userManager.getAllUsers());
      io.emit('notification', {
        type: 'user:left',
        username: user.username,
        timestamp: new Date().toISOString()
      });
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS configured for: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});