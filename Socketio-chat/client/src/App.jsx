import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './context/SocketContext';
import ChatRoom from './components/ChatRoom';
import UserList from './components/UserList';
import PrivateChat from './components/PrivateChat';
import Notification from './components/Notification';
import './styles.css';

function App() {
  const socket = useContext(SocketContext);
  const [username, setUsername] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeRoom, setActiveRoom] = useState('general');
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim().length >= 3) {
      socket.auth = { username };
      socket.connect();
      setLoggedIn(true);
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!loggedIn) return;

    const onUserList = (userList) => {
      setUsers(userList);
      // Initialize unread counts
      const counts = {};
      userList.forEach(user => {
        if (user.username !== username) {
          counts[`private-${user.username}`] = 0;
        }
      });
      setUnreadCounts(counts);
    };

    const onNotification = (notification) => {
      setNotifications(prev => [...prev, notification]);
      
      // Play sound for new messages
      if (notification.type === 'newPrivateMessage') {
        new Audio('/notification.mp3').play().catch(() => {});
        
        // Update unread count
        if (activeRoom !== `private-${notification.from}`) {
          setUnreadCounts(prev => ({
            ...prev,
            [`private-${notification.from}`]: (prev[`private-${notification.from}`] || 0) + 1
          }));
        }
      }

      // Browser notifications
      if (Notification.permission === 'granted') {
        new Notification(
          notification.type === 'userJoined' ? 'User Joined' : 'New Message',
          { 
            body: notification.type === 'userJoined' 
              ? `${notification.username} joined the chat` 
              : `New message from ${notification.from}`
          }
        );
      }
    };

    socket.on('user:list', onUserList);
    socket.on('notification', onNotification);

    return () => {
      socket.off('user:list', onUserList);
      socket.off('notification', onNotification);
    };
  }, [loggedIn, activeRoom, username]);

  // Request notification permissions
  useEffect(() => {
    if (loggedIn && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="login-screen">
        <h1>Socket.io Chat</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            minLength={3}
            required
          />
          <button type="submit">Join Chat</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="user-header">
          <h3>Logged in as: {username}</h3>
          <div className="status-indicator online">Online</div>
        </div>
        
        <div className="room-tabs">
          <button
            className={activeRoom === 'general' ? 'active' : ''}
            onClick={() => setActiveRoom('general')}
          >
            General Chat
          </button>
          
          {users
            .filter(user => user.username !== username)
            .map(user => (
              <button
                key={user.username}
                className={activeRoom === `private-${user.username}` ? 'active' : ''}
                onClick={() => {
                  setActiveRoom(`private-${user.username}`);
                  // Mark messages as read
                  setUnreadCounts(prev => ({
                    ...prev,
                    [`private-${user.username}`]: 0
                  }));
                }}
              >
                {user.username}
                {unreadCounts[`private-${user.username}`] > 0 && (
                  <span className="unread-badge">
                    {unreadCounts[`private-${user.username}`]}
                  </span>
                )}
              </button>
            ))}
        </div>

        <UserList users={users} currentUser={username} />
      </div>

      <div className="main-content">
        {activeRoom === 'general' ? (
          <ChatRoom 
            room="general" 
            currentUser={username} 
          />
        ) : (
          <PrivateChat
            recipient={activeRoom.replace('private-', '')}
            currentUser={username}
          />
        )}
      </div>

      <div className="notifications">
        {notifications.map((note, i) => (
          <Notification 
            key={i} 
            type={note.type} 
            username={note.username || note.from} 
            timestamp={note.timestamp}
          />
        ))}
      </div>
    </div>
  );
}

export default App;