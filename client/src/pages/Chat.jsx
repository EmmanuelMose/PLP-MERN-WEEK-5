import React, { useEffect, useState, useRef } from 'react';
import  socket  from '../socket';
import Message from '../components/Message';
import RoomList from '../components/RoomList';
import dayjs from 'dayjs';
import './Chat.css';


export default function Chat({ username, onLogout }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState(['global']);
  const [currentRoom, setCurrentRoom] = useState('global');
  const [messages, setMessages] = useState([]); 
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});
  const [file, setFile] = useState(null);
  const msgBoxRef = useRef();

  // join and listen
  useEffect(() => {
    socket.on('onlineUsers', (list) => setOnlineUsers(list));

    socket.on('joined', (data) => {
      setRooms(data.rooms || ['global']);
      if (data.lastMessages) setMessages(data.lastMessages);
    });

    socket.on('roomJoined', ({ room, lastMessages }) => {
      setCurrentRoom(room);
      setMessages(lastMessages || []);
    });

    socket.on('message', ({ room, message }) => {
      if (room === currentRoom) {
        setMessages(m => [...m, message]);
        playSound();
        notifyBrowser(`${message.from}: ${message.text || 'file'}`);
      } else {
        // increment unread counts
        setUnreadCounts(prev => ({ ...prev, [room]: (prev[room] || 0) + 1 }));
      }
    });

    socket.on('privateMessage', (message) => {
      // show as a special message; for simplicity, we push into messages if in private room
      const roomName = `private_${[message.from, username].sort().join('_')}`;
      if (currentRoom === roomName) setMessages(m => [...m, message]);
      else setUnreadCounts(prev => ({ ...prev, [roomName]: (prev[roomName] || 0) + 1 }));
      notifyBrowser(`PM from ${message.from}`);
      playSound();
    });

    socket.on('typing', ({ username: who, isTyping }) => {
      setTypingUsers(prev => {
        const s = new Set(prev);
        if (isTyping) s.add(who); else s.delete(who);
        return s;
      });
    });

    socket.on('notification', data => {
      console.log('NOTIF', data);
    });

    socket.on('olderMessages', ({ messages: older }) => {
      setMessages(prev => [...older, ...prev]);
    });

    socket.on('messageRead', ({ messageId, username: reader }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, readBy: (m.readBy || []).concat(reader) } : m));
    });

    socket.on('reaction', ({ messageId, username: who, reaction }) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        reactions[reaction] = Array.from(new Set([...(reactions[reaction]||[]), who]));
        return { ...m, reactions };
      }));
    });

    // cleanup
    return () => {
      socket.offAny && socket.offAny();
      socket.off('onlineUsers'); socket.off('joined'); socket.off('message'); socket.off('typing');
      socket.off('privateMessage'); socket.off('roomJoined'); socket.off('olderMessages');
    };
  }, [currentRoom, username]);

  // request browser notification permission
  useEffect(() => {
    if (Notification && Notification.permission !== 'granted') Notification.requestPermission();
  }, []);

  function sendMessage(e) {
    e?.preventDefault();
    if (!text && !file) return;
    // If file: client should upload file to /upload then send message with file.url
    if (file) {
      // simple upload using fetch
      const form = new FormData();
      form.append('file', file);
      fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:5000') + '/upload', { method: 'POST', body: form })
        .then(r => r.json())
        .then(data => {
          socket.emit('sendMessage', { room: currentRoom, text, file: { url: data.url, name: file.name } });
        })
        .catch(console.error);
      setFile(null);
    } else {
      socket.emit('sendMessage', { room: currentRoom, text });
    }
    setText('');
    socket.emit('typing', { room: currentRoom, isTyping: false });
  }

  function startTyping() {
    socket.emit('typing', { room: currentRoom, isTyping: true });
  }
  function stopTyping() {
    socket.emit('typing', { room: currentRoom, isTyping: false });
  }

  function loadOlder() {
    socket.emit('loadMore', { room: currentRoom, offset: messages.length, limit: 20 });
  }

  function openRoom(room) {
    setUnreadCounts(prev => ({ ...prev, [room]: 0 }));
    socket.emit('joinRoom', { room });
    setCurrentRoom(room);
  }

  function playSound() {
    // create a short beep (or you can play an audio file)
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 600;
    o.connect(g); g.connect(ctx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2);
    setTimeout(()=>{ o.stop(); ctx.close(); }, 250);
  }

  function notifyBrowser(body) {
    if (Notification && Notification.permission === 'granted') {
      new Notification('Chat', { body });
    }
  }

  return (
    <div className="chat-container">
      <aside className="sidebar">
        <div className="me">
          <div><strong>{username}</strong></div>
          <button onClick={onLogout}>Logout</button>
        </div>
        <RoomList rooms={rooms} current={currentRoom} onOpen={openRoom} unreadCounts={unreadCounts} />
        <div className="online">
          <h4>Online</h4>
          <ul>
            {onlineUsers.map(u => <li key={u}>{u}</li>)}
          </ul>
        </div>
      </aside>

      <main className="main">
        <header>
          <h3>{currentRoom}</h3>
          <div className="typing-indicator">
            {Array.from(typingUsers).filter(t=>t!==username).slice(0,3).join(', ')} {typingUsers.size ? 'is typing...' : ''}
          </div>
        </header>

        <div className="messages" ref={msgBoxRef}>
          <button onClick={loadOlder}>Load older messages</button>
          {messages.map(m => <Message key={m.id} msg={m} me={m.from === username} onReact={(reaction)=> socket.emit('react', { room: currentRoom, messageId: m.id, reaction })} onRead={() => socket.emit('messageRead', { room: currentRoom, messageId: m.id })} />)}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={startTyping} onKeyUp={() => setTimeout(stopTyping, 500)} placeholder="Type a message" />
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  );
}
