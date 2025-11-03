import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Chat from './pages/Chat';
import  socket  from './socket';

export default function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || null);

  useEffect(() => {
    if (username) {
      socket.auth = { username };
      socket.connect();
      socket.emit('login', { username });
    }
    return () => {
      if (socket.connected) socket.disconnect();
    };
  }, [username]);

  return (
    <div className="app">
      {username ? <Chat username={username} onLogout={() => { localStorage.removeItem('username'); setUsername(null); socket.disconnect(); }} /> 
                : <Login onLogin={(name) => { localStorage.setItem('username', name); setUsername(name); }} />}
    </div>
  );
}
