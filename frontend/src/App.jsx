import React, { useState, useEffect } from "react";
import './App.css';
import { Editor } from "@monaco-editor/react";

function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");

    socket.onopen = () => {
      console.log("WebSocket connection established");
      setConnected(true);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setConnected(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
    };
  }, [])
  return (
    <div className="App">
      <h1>WebSocket Connection Status: {connected ? "Connected" : "Disconnected"}</h1>
      <Editor
        height="100vh"
        defaultLanguage="javascript"
        theme="vs-dark"
        defaultValue="// Write your code here"
      />
    </div>
  )
};

export default App;