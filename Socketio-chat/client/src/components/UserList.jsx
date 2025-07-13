import { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';

export default function UserList() {
  const socket = useContext(SocketContext);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    socket.on('user:list', (userList) => {
      setUsers(userList);
    });

    return () => {
      socket.off('user:list');
    };
  }, []);

  return (
    <div className="user-list">
      <h3>Online Users ({users.length})</h3>
      <ul>
        {users.map((user, i) => (
          <li key={i} className={user.online ? 'online' : 'offline'}>
            {user.username}
            <span>{user.online ? '🟢' : '🔴'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}