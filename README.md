# PLP MERN WEEK 5 Project

This project is a full-stack MERN (MongoDB, Express, React, Node.js) application that demonstrates real-time communication using **Socket.io** and backend file uploads using **Multer**.

---

## 🚀 Project Structure

```
PLP MERN WEEK 5/
│
├── client/       # Frontend (React + Vite)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
└── server/       # Backend (Node.js + Express + Socket.io)
    ├── index.js
    ├── package.json
    └── uploads/ (optional for Multer file storage)
```

---

## ⚙️ Features

* Real-time communication via **Socket.io**
* File upload handling with **Multer**
* CORS-enabled Express API
* Frontend built using **React + Vite**
* Development with **Nodemon** for live server reloads

---

## 🧩 Backend Setup (Server)

1. Open terminal in the `server` folder:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. By default, the backend runs on:

   ```
   http://localhost:5000
   ```

### 📦 Dependencies

* **express** – Web framework for Node.js
* **cors** – Enables cross-origin resource sharing
* **socket.io** – Real-time communication library
* **multer** – Middleware for handling `multipart/form-data` (file uploads)
* **nodemon** – Automatically restarts the server on file changes (dev dependency)

---

## 💻 Frontend Setup (Client)

1. Open a new terminal in the `client` folder:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the Vite development server:

   ```bash
   pnpm dev
   ```

4. Visit the frontend:

   ```
   http://localhost:5173
   ```

---

## 🔌 Connecting Frontend and Backend

The client uses **Socket.io Client** to connect to the backend server running at `http://localhost:5000`.

Example `socket.js`:

```js
import { io } from 'socket.io-client';

export const socket = io('http://localhost:5000', {
  transports: ['websocket'],
});
```

Then import in your React components:

```js
import { socket } from './socket';
```

---

## 🧠 Troubleshooting

* If `multer` installation fails, run:

  ```bash
  pnpm remove multer
  pnpm add multer@2.0.2
  ```

* Ensure both client and server are running simultaneously.

* If `vite` or `socket.io-client` errors occur, reinstall node modules:

  ```bash
  pnpm install
  ```

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

---

## 👤 Author

**Emmanuel Mose**
GitHub: [EmmanuelMose](https://github.com/EmmanuelMose)
