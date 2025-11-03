// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Simple file upload config (optional)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// HTTP endpoints for uploaded files
app.use('/uploads', express.static(uploadDir));
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send({ error: 'No file' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.send({ url });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});


const users = new Map();
const usernameToSocket = new Map();
const rooms = new Map(); // roomName => Set of usernames
const messageStore = new Map(); // room => [{id, from, text, ts, readBy:[], reactions:{}}]

let messageIdCounter = 1;

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  // Client should emit 'login' with username
  socket.on('login', ({ username }) => {
    if (!username) return;
    users.set(socket.id, { username, currentRoom: 'global' });
    usernameToSocket.set(username, socket.id);

    // add to default room
    socket.join('global');
    if (!rooms.has('global')) rooms.set('global', new Set());
    rooms.get('global').add(username);

    // broadcast online list update
    io.emit('onlineUsers', Array.from(usernameToSocket.keys()));

    // notify room
    io.to('global').emit('notification', { message: `${username} joined global` });

    // send client initial data (rooms, last messages)
    socket.emit('joined', {
      username,
      rooms: Array.from(rooms.keys()),
      lastMessages: getRecentMessages('global')
    });

    console.log(`${username} logged in`);
  });

  // Join room
  socket.on('joinRoom', ({ room }) => {
    const u = users.get(socket.id);
    if (!u) return;
    const username = u.username;

    // leave previous
    const prev = u.currentRoom;
    if (prev) {
      socket.leave(prev);
      rooms.get(prev)?.delete(username);
      io.to(prev).emit('notification', { message: `${username} left ${prev}` });
    }

    // join new
    u.currentRoom = room;
    socket.join(room);
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(username);
    io.to(room).emit('notification', { message: `${username} joined ${room}` });

    // send recent messages for pagination / load
    socket.emit('roomJoined', { room, lastMessages: getRecentMessages(room) });

    // update online list (emit full)
    io.emit('onlineUsers', Array.from(usernameToSocket.keys()));
  });

  // Leave room
  socket.on('leaveRoom', ({ room }) => {
    const u = users.get(socket.id);
    if (!u) return;
    const username = u.username;
    socket.leave(room);
    rooms.get(room)?.delete(username);
    io.to(room).emit('notification', { message: `${username} left ${room}` });
  });

  // Global chat (or room chat)
  socket.on('sendMessage', ({ room, text, toUserId, isPrivate, file }) => {
    const u = users.get(socket.id);
    if (!u) return;
    const from = u.username;
    const ts = Date.now();
    const id = messageIdCounter++;

    const msg = { id, from, text: text || null, ts, file: file || null, readBy: [], reactions: {} };

    if (isPrivate && toUserId) {
      // send to recipient and sender only
      const toSocket = usernameToSocket.get(toUserId);
      if (toSocket) {
        io.to(toSocket).to(socket.id).emit('privateMessage', msg);
      } else {
        socket.emit('notification', { message: `${toUserId} is offline` });
      }
      // optionally persist under a synthetic room name
      saveMessage(getPrivateRoomName(from, toUserId), msg);
    } else {
      // broadcast to room
      const targetRoom = room || u.currentRoom || 'global';
      saveMessage(targetRoom, msg);
      io.to(targetRoom).emit('message', { room: targetRoom, message: msg });
    }
  });

  // Typing indicator
  socket.on('typing', ({ room, isTyping, toUserId, isPrivate }) => {
    const u = users.get(socket.id);
    if (!u) return;
    const payload = { username: u.username, isTyping };
    if (isPrivate && toUserId) {
      const s = usernameToSocket.get(toUserId);
      if (s) io.to(s).emit('typing', payload);
    } else {
      io.to(room || u.currentRoom || 'global').emit('typing', payload);
    }
  });

  // Read receipts
  socket.on('messageRead', ({ room, messageId }) => {
    const u = users.get(socket.id);
    if (!u) return;
    markMessageRead(room || u.currentRoom || 'global', messageId, u.username);
    // notify others
    io.to(room || u.currentRoom || 'global').emit('messageRead', { messageId, username: u.username });
  });

  // Reaction to a message
  socket.on('react', ({ room, messageId, reaction }) => {
    const u = users.get(socket.id);
    if (!u) return;
    addReaction(room || u.currentRoom || 'global', messageId, u.username, reaction);
    io.to(room || u.currentRoom || 'global').emit('reaction', { messageId, username: u.username, reaction });
  });

  // Pagination: client asks for older messages: 'loadMore'
  socket.on('loadMore', ({ room, offset = 0, limit = 20 }) => {
    const msgs = getMessages(room || users.get(socket.id)?.currentRoom || 'global', offset, limit);
    socket.emit('olderMessages', { room, messages: msgs });
  });

  // File upload can be handled via /upload endpoint + returning URL, or via socket binary emit.
  // For demo we assume client will upload to /upload then send a message with file.url.

  socket.on('disconnect', (reason) => {
    const u = users.get(socket.id);
    if (u) {
      const username = u.username;
      usernameToSocket.delete(username);
      // remove from rooms
      for (const [roomName, set] of rooms) set.delete(username);
      users.delete(socket.id);
      io.emit('onlineUsers', Array.from(usernameToSocket.keys()));
      console.log(`${username} disconnected: ${reason}`);
      // notify all where they were
      io.emit('notification', { message: `${username} disconnected` });
    }
  });
});

// Helpers
function saveMessage(room, msg) {
  if (!messageStore.has(room)) messageStore.set(room, []);
  messageStore.get(room).push(msg);
  // cap for demo
  if (messageStore.get(room).length > 1000) messageStore.set(room, messageStore.get(room).slice(-1000));
}

function getRecentMessages(room, count = 50) {
  if (!messageStore.has(room)) return [];
  const arr = messageStore.get(room);
  return arr.slice(-count);
}

function getMessages(room, offset = 0, limit = 20) {
  // offset 0 -> newest; for demo we return older messages from end
  const arr = messageStore.get(room) || [];
  const start = Math.max(0, arr.length - offset - limit);
  const end = Math.max(0, arr.length - offset);
  return arr.slice(start, end);
}

function markMessageRead(room, messageId, username) {
  const arr = messageStore.get(room) || [];
  const m = arr.find(x => x.id === messageId);
  if (m && !m.readBy.includes(username)) m.readBy.push(username);
}
function addReaction(room, messageId, username, reaction) {
  const arr = messageStore.get(room) || [];
  const m = arr.find(x => x.id === messageId);
  if (!m) return;
  if (!m.reactions[reaction]) m.reactions[reaction] = [];
  if (!m.reactions[reaction].includes(username)) m.reactions[reaction].push(username);
}
function getPrivateRoomName(a, b) {
  return `private_${[a,b].sort().join('_')}`;
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
