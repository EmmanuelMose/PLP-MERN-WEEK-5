import React from 'react';
import dayjs from 'dayjs';
import './Message.css';


export default function Message({ msg, me, onReact, onRead }) {
  return (
    <div className={`message ${me ? 'me' : ''}`}>
      <div className="meta">
        <strong>{msg.from}</strong>
        <span className="time">{dayjs(msg.ts).format('HH:mm:ss')}</span>
      </div>
      <div className="body">
        {msg.text && <p>{msg.text}</p>}
        {msg.file && <p><a href={msg.file.url} target="_blank" rel="noreferrer">📎 {msg.file.name}</a></p>}
      </div>
      <div className="message-controls">
        <button onClick={() => onReact && onReact('like')}></button>
        <button onClick={() => onReact && onReact('love')}></button>
        <button onClick={onRead}>Mark read</button>
      </div>
      <div className="reactions">
        {msg.reactions && Object.entries(msg.reactions).map(([r, users]) => (
          <span key={r}>{r} {users.length}</span>
        ))}
      </div>
      <div className="read-by">
        {msg.readBy && msg.readBy.length > 0 && <small>Read by: {msg.readBy.join(', ')}</small>}
      </div>
    </div>
  );
}
