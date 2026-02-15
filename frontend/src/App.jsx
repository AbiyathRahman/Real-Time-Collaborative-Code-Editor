import React, { useState, useEffect } from "react";
import './App.css';
import { Editor } from "@monaco-editor/react";
import io from 'socket.io-client';

function App() {
  const [documentContent, setDocumentContent] = useState("");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Generate unique user ID and get username
    const userId = Math.random().toString(36).substr(2, 9);
    const username = `User-${Math.floor(Math.random() * 1000)}`;
    const roomId = 'default-room';

    // Connect to Socket.IO server
    const newSocket = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connected:', newSocket.id);
      setConnected(true);

      // Join room
      newSocket.emit('join-room', {
        roomId,
        userId,
        username
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setConnected(false);
    });

    newSocket.on('document-loaded', (data) => {
      console.log('Document loaded:', data);
      setDocumentContent(data.content);
    });

    newSocket.on('content-changed', (data) => {
      console.log('Content changed by user:', data.username);
      setDocumentContent(data.content);
    });

    newSocket.on('user-joined', (data) => {
      console.log('Users in room:', data.users);
      setUsers(data.users);
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data.username);
      setUsers(data.users);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [])

  const handleEditorChange = (value) => {
    setDocumentContent(value);
    if (socket) {
      socket.emit('edit', {
        content: value,
        version: 1
      });
    }
  };

  return (
    <div className="App">
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#1e1e1e', color: '#fff' }}>
        <h1>Connection Status: <span style={{ color: connected ? '#4ec919' : '#f48771' }}>{connected ? "Connected" : "Disconnected"}</span></h1>
        <div style={{ marginRight: '20px' }}>
          <h3>Active Users ({users.length}):</h3>
          <ul>
            {users.map((user, idx) => (
              <li key={idx} style={{ color: user.color }}>
                {user.username}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Editor
        height="100vh"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={documentContent}
        onChange={handleEditorChange}
        defaultValue="// Write your code here"
      />
    </div>
  )
};

export default App;