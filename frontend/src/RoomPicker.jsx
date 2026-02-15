import React, { useState } from 'react';
import './RoomPicker.css';

function RoomPicker({ onRoomSelected }) {
    const [roomInput, setRoomInput] = useState('');
    const [error, setError] = useState('');

    const generateRoomId = () => {
        return Math.random().toString(36).substr(2, 9).toUpperCase();
    };

    const handleJoinRoom = () => {
        const trimmedRoom = roomInput.trim().toUpperCase();
        if (!trimmedRoom) {
            setError('Please enter a room ID');
            return;
        }
        setError('');
        onRoomSelected(trimmedRoom);
    };

    const handleCreateRoom = () => {
        const newRoomId = generateRoomId();
        setError('');
        onRoomSelected(newRoomId);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleJoinRoom();
        }
    };

    return (
        <div className="room-picker-overlay">
            <div className="room-picker-container">
                <div className="room-picker-content">
                    <h1 className="room-picker-title">Real-Time Code Editor</h1>
                    <p className="room-picker-subtitle">Join or create a room to start collaborating</p>

                    <div className="room-picker-form">
                        <div className="form-group">
                            <label htmlFor="room-input" className="form-label">
                                Room ID
                            </label>
                            <input
                                id="room-input"
                                type="text"
                                placeholder="Enter room ID or leave blank"
                                value={roomInput}
                                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                                onKeyPress={handleKeyPress}
                                className="room-input"
                            />
                            {error && <p className="error-message">{error}</p>}
                        </div>

                        <div className="button-group">
                            <button
                                onClick={handleJoinRoom}
                                className="btn btn-primary"
                            >
                                Join Room
                            </button>
                            <button
                                onClick={handleCreateRoom}
                                className="btn btn-secondary"
                            >
                                Create New Room
                            </button>
                        </div>

                        <div className="room-picker-info">
                            <p className="info-text">
                                <span className="info-icon">ℹ️</span>
                                Share the room ID with others to collaborate in the same workspace
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RoomPicker;
