import React from 'react';
import './RoomList.css';
export default function RoomList({ rooms, current, onOpen, unreadCounts }) {
  return (
    <div className="rooms">
      <h4>Rooms</h4>
      <ul>
        {rooms.map(r => (
          <li key={r} className={r===current ? 'active' : ''} onClick={() => onOpen(r)}>
            {r} {unreadCounts[r] ? <span className="badge">{unreadCounts[r]}</span> : null}
          </li>
        ))}
      </ul>
      <button onClick={() => {
        const name = prompt('New room name');
        if (name) onOpen(name);
      }}>+ New room</button>
    </div>
  );
}
