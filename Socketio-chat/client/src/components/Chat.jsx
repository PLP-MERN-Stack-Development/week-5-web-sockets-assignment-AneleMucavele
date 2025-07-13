import { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../context/SocketContext';
import Message from './Message';
import TypingIndicator from './TypingIndicator';

export default function Chat({ username }) {
  const socket = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on('message:new', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('typing:update', (users) => {
      setTypingUsers(users);
    });

    socket.on('user:list', () => {
      // Force scroll to bottom when users join/leave
      scrollToBottom();
    });

    return () => {
      socket.off('message:new');
      socket.off('typing:update');
      socket.off('user:list');
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('message:send', { 
        room: 'general', 
        text: message 
      });
      setMessage('');
    }
  };

  const handleTyping = () => {
    socket.emit('typing:start', 'general');
    const timeout = setTimeout(() => {
      socket.emit('typing:stop', 'general');
    }, 3000);
    return () => clearTimeout(timeout);
  };

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} message={msg} currentUser={username} />
        ))}
        <TypingIndicator users={typingUsers} />
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="message-form">
        <input
          type="text"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}