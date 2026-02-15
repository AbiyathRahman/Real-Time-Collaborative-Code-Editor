import React, { useState, useEffect, useRef } from "react";
import './App.css';
import { Editor } from "@monaco-editor/react";
import io from 'socket.io-client';
import PresenceBar from './PresenceBar';
import Toast from './Toast';
import RoomPicker from './RoomPicker';

function App() {
  const [documentContent, setDocumentContent] = useState("");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [version, setVersion] = useState(0);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [toasts, setToasts] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState('javascript');

  const SUPPORTED_LANGUAGES = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'php', label: 'PHP' },
    { value: 'sql', label: 'SQL' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'markdown', label: 'Markdown' },
  ];

  const userIdRef = useRef(null);
  const usernameRef = useRef(null);
  const versionRef = useRef(0);
  const contentRef = useRef("");
  const editorRef = useRef(null);
  const cursorThrottleRef = useRef({});

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect operation type by comparing old and new content
  const detectOperation = (oldContent, newContent, currentUserId, currentVersion) => {
    const oldLen = oldContent.length;
    const newLen = newContent.length;

    if (newLen > oldLen) {
      // Insert operation
      const diff = newLen - oldLen;
      // Find where the insertion happened
      for (let i = 0; i < oldLen; i++) {
        if (oldContent[i] !== newContent[i]) {
          const insertedText = newContent.substring(i, i + diff);
          return {
            type: 'insert',
            position: i,
            text: insertedText,
            userId: currentUserId,
            version: currentVersion
          };
        }
      }
      // Insertion at the end
      return {
        type: 'insert',
        position: oldLen,
        text: newContent.substring(oldLen),
        userId: currentUserId,
        version: currentVersion
      };
    } else if (newLen < oldLen) {
      // Delete operation
      const diff = oldLen - newLen;
      for (let i = 0; i < newLen; i++) {
        if (oldContent[i] !== newContent[i]) {
          return {
            type: 'delete',
            position: i,
            length: diff,
            userId: currentUserId,
            version: currentVersion
          };
        }
      }
      // Deletion at the end
      return {
        type: 'delete',
        position: newLen,
        length: diff,
        userId: currentUserId,
        version: currentVersion
      };
    }

    return null; // No change
  };

  // Add toast notification with auto-removal
  const addToast = (message, type = 'join') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Restore language preference for the room when roomId changes
  useEffect(() => {
    if (!roomId) return;

    const savedLanguage = localStorage.getItem(`room-${roomId}-language`);
    if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.value === savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, [roomId]);

  // Save language preference whenever it changes
  useEffect(() => {
    if (roomId) {
      localStorage.setItem(`room-${roomId}-language`, language);
    }
  }, [language, roomId]);

  useEffect(() => {
    // Don't connect if no room selected
    if (!roomId) return;

    // Check if socket already exists for this room (prevent duplicate connections)
    if (socket && socket.connected && socket.roomId === roomId) {
      return;
    }

    // Generate unique user ID and get username
    const newUserId = Math.random().toString(36).substr(2, 9);
    userIdRef.current = newUserId;

    const username = `User-${Math.floor(Math.random() * 1000)}`;
    usernameRef.current = username;

    // Connect to Socket.IO server
    const newSocket = io('http://localhost:4000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.roomId = roomId; // Track which room this socket is for

    newSocket.on('connect', () => {
      console.log('Socket.IO connected:', newSocket.id);
      setConnected(true);

      // Join room
      newSocket.emit('join-room', {
        roomId,
        userId: newUserId,
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
      contentRef.current = data.content;
      setVersion(data.version);
      versionRef.current = data.version;
    });

    newSocket.on('content-changed', (data) => {
      console.log('Operation received from server:', data);
      // Only apply if NOT from the current user
      if (data.userId !== newUserId) {
        // Apply remote operation using the current content reference
        let newContent = contentRef.current;

        if (data.operation.type === 'insert') {
          newContent =
            newContent.slice(0, data.operation.position) +
            data.operation.text +
            newContent.slice(data.operation.position);
        } else if (data.operation.type === 'delete') {
          newContent =
            newContent.slice(0, data.operation.position) +
            newContent.slice(data.operation.position + data.operation.length);
        }

        contentRef.current = newContent;
        setDocumentContent(newContent);
        setVersion(data.version);
        versionRef.current = data.version;
      }
    });

    newSocket.on('user-joined', (data) => {
      console.log('Users in room:', data.users);
      setUsers(data.users);
      // Show join notification for newly joined user
      if (data.username !== username) {
        addToast(`${data.username} joined the room`, 'join');
      }
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data.username);
      setUsers(data.users);
      addToast(`${data.username} left the room`, 'leave');
      // Remove cursor when user leaves
      setRemoteCursors(prev => {
        const updated = { ...prev };
        delete updated[data.userId];
        return updated;
      });
    });

    newSocket.on('remote-cursor', (data) => {
      console.log('Remote cursor:', data);
      setRemoteCursors(prev => ({
        ...prev,
        [data.socketId]: data
      }));
    });

    newSocket.on('cursor-removed', (data) => {
      console.log('Cursor removed:', data.socketId);
      setRemoteCursors(prev => {
        const updated = { ...prev };
        delete updated[data.socketId];
        return updated;
      });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomId])

  const handleEditorChange = (value) => {
    if (!socket || !userIdRef.current) return;

    // Detect what changed using the content ref (always current)
    const operation = detectOperation(contentRef.current, value, userIdRef.current, versionRef.current + 1);

    if (operation) {
      console.log('Sending operation:', operation);
      socket.emit('edit', { operation });
    }

    // Update local refs and state
    contentRef.current = value;
    setDocumentContent(value);
    versionRef.current += 1;
    setVersion(versionRef.current);
  };

  const getCursorPixelPosition = (lineNumber, column) => {
    if (!editorRef.current) return { top: 0, left: 0 };

    try {
      const editor = editorRef.current;
      const layoutInfo = editor.getLayoutInfo();

      // Get the scrolled visible position - already viewport-relative
      const position = { lineNumber, column };
      const coords = editor.getScrolledVisiblePosition(position);

      if (!coords) {
        return { top: 0, left: 0 };
      }

      // coords are already viewport-relative from getScrolledVisiblePosition
      // We need to account for the gutter width to position cursor at correct column
      const gutterWidth = layoutInfo.lineNumbersWidth + layoutInfo.glyphMarginWidth;

      // Return coordinates relative to editor viewport
      return {
        top: coords.top,
        left: coords.left + gutterWidth
      };
    } catch (err) {
      console.error("Error calculating cursor position:", err);
      return { top: 0, left: 0 };
    }
  };

  const overlayWidgetsRef = useRef(new Map());

  const createCursorOverlay = (socketId, cursor) => {
    const domNode = document.createElement('div');
    domNode.className = 'remote-cursor-overlay';
    domNode.style.borderLeftColor = cursor.color;

    const label = document.createElement('div');
    label.className = 'cursor-overlay-label';
    label.style.backgroundColor = cursor.color;
    label.textContent = cursor.username.split('-')[1];

    domNode.appendChild(label);

    return {
      getId: () => `cursor-overlay-${socketId}`,
      getDomNode: () => domNode,
      getPosition: () => null  // Return null for free positioning
    };
  };

  const updateCursorOverlay = (socketId, cursor) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;

    // Remove old widget if exists
    if (overlayWidgetsRef.current.has(socketId)) {
      try {
        editor.removeOverlayWidget(overlayWidgetsRef.current.get(socketId));
      } catch (err) {
        console.error("Error removing old widget:", err);
      }
    }

    // Create and add new widget
    try {
      const widget = createCursorOverlay(socketId, cursor);
      editor.addOverlayWidget(widget);
      overlayWidgetsRef.current.set(socketId, widget);

      // Get position and apply directly to DOM node
      const position = getCursorPixelPosition(cursor.line, cursor.column);
      const domNode = widget.getDomNode();

      // Set positioning styles directly on the node
      domNode.style.position = 'fixed';
      domNode.style.top = `${position.top}px`;
      domNode.style.left = `${position.left}px`;

    } catch (err) {
      console.error("Error updating cursor overlay:", err);
    }
  };

  const removeCursorOverlay = (socketId) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    if (overlayWidgetsRef.current.has(socketId)) {
      const widget = overlayWidgetsRef.current.get(socketId);
      try {
        editor.removeOverlayWidget(widget);
      } catch (err) {
        console.error("Error removing cursor overlay:", err);
      }
      overlayWidgetsRef.current.delete(socketId);
    }
  };

  // Update overlays when remote cursors change
  useEffect(() => {
    if (!editorRef.current) return;

    // Remove cursors that no longer exist
    overlayWidgetsRef.current.forEach((widget, socketId) => {
      if (!remoteCursors[socketId]) {
        removeCursorOverlay(socketId);
      }
    });

    // Add or update cursors
    Object.entries(remoteCursors).forEach(([socketId, cursor]) => {
      updateCursorOverlay(socketId, cursor);
    });
  }, [remoteCursors]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;

    // Track cursor movement with throttling
    editor.onDidChangeCursorPosition((e) => {
      if (!socket) return;

      const { lineNumber, column } = e.position;

      // Throttle cursor updates to avoid too many messages (100ms)
      const now = Date.now();
      if (cursorThrottleRef.current.lastTime && now - cursorThrottleRef.current.lastTime < 100) {
        return;
      }

      cursorThrottleRef.current.lastTime = now;

      socket.emit('cursor-move', {
        line: lineNumber,
        column
      });
    });
  };

  if (!roomId) {
    return <RoomPicker onRoomSelected={setRoomId} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-info">
          <span className="user-id">{usernameRef.current}</span>
          <div className="room-id-display">
            <span className="room-id-label">Room:</span>
            <span className="room-id-value">{roomId}</span>
            <button
              className="copy-room-btn"
              onClick={copyRoomId}
              title="Copy room ID to clipboard"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
          <div className="language-selector-wrapper">
            <label htmlFor="language-select" className="language-label">Language:</label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="language-select"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <h1 className="app-title">
          Real-Time Code Editor
          <span className="connection-status" style={{ color: connected ? '#4ec919' : '#f48771' }}>
            ● {connected ? "Connected" : "Disconnected"}
          </span>
        </h1>
      </header>

      <Toast toasts={toasts} />

      <div className="app-container">
        <div className="editor-wrapper">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={documentContent}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            defaultValue="// Write your code here"
            options={{
              wordWrap: 'on',
              minimap: { enabled: true }
            }}
          />
        </div>
        <PresenceBar users={users} cursors={remoteCursors} />
      </div>
    </div>
  );
}

export default App;