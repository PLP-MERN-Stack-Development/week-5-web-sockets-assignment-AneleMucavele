export default function TypingIndicator({ users }) {
  if (users.length === 0) return null;

  return (
    <div className="typing-indicator">
      <p>
        {users.length === 1
          ? `${users[0]} is typing...`
          : `${users.join(' and ')} are typing...`}
      </p>
    </div>
  );
}