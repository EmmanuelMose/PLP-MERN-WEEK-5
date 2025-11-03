import React, { useState } from 'react';
import './Login.css';


export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const submit = e => {
    e.preventDefault();
    if (username.trim()) onLogin(username.trim());
  };
  return (
    <div className="login">
      <h2>Join Chat</h2>
      <form onSubmit={submit}>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" />
        <button type="submit">Enter</button>
      </form>
    </div>
  );
}
