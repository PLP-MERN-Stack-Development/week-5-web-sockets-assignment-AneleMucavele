export default function Message({ message, currentUser }) {
  const isCurrentUser = message.from === currentUser;
  const time = new Date(message.timestamp).toLocaleTimeString();

  return (
    <div className={`message ${isCurrentUser ? 'sent' : 'received'}`}>
      {!isCurrentUser && <span className="sender">{message.from}</span>}
      <div className="message-content">
        <p>{message.text}</p>
        <span className="timestamp">{time}</span>
      </div>
    </div>
  );
}