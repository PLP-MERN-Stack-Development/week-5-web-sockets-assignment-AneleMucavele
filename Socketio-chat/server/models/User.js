class User {
  constructor() {
    this.users = new Map(); // socket.id -> user data
  }

  addUser(socketId, username) {
    this.users.set(socketId, { username, online: true });
    return this.getUser(socketId);
  }

  getUser(socketId) {
    return this.users.get(socketId);
  }

  removeUser(socketId) {
    const user = this.getUser(socketId);
    if (user) {
      this.users.delete(socketId);
    }
    return user;
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }
}

module.exports = new User();