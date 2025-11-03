// client/src/socket.js
import { io } from "socket.io-client";

// Connect to your backend server
const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  reconnection: true,
});

export default socket;
