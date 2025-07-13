import { useState, useContext, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';
import Message from './Message';

export default function ChatRoom({ room, currentUser }) {
  const socket = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    socket.on('message:new', (msg) => {
      if (msg.room === room) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      socket.off('message:new');
    };
  }, [room]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      socket.emit('message:send', {
        room,
        text: messageInput
      });
      setMessageInput('');
    }
  };

  return (
    <div className="chat-room">
      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} message={msg} currentUser={currentUser} />
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder={`Message in ${room}`}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}