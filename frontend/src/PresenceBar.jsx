import React from 'react';
import './PresenceBar.css';

function PresenceBar({ users = [], cursors = {} }) {
    return (
        <div className="presence-bar">
            <div className="presence-header">
                <h3>Active Users ({users.length})</h3>
            </div>

            <div className="presence-list">
                {users.length === 0 ? (
                    <p className="no-users">Waiting for users...</p>
                ) : (
                    <ul className="user-list">
                        {users.map((user, idx) => {
                            const cursor = Object.values(cursors).find(c => c.userId === user.userId);
                            return (
                                <li key={idx} className="user-item">
                                    <div
                                        className="user-avatar"
                                        style={{ backgroundColor: user.color }}
                                        title={user.username}
                                    >
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="user-info">
                                        <span className="user-name">{user.username}</span>
                                        {cursor && (
                                            <span className="user-cursor-position">
                                                {cursor.line}:{cursor.column}
                                            </span>
                                        )}
                                    </div>
                                    <div className="user-status online"></div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="presence-footer">
                <div className="status-indicator">
                    <div className="status-dot"></div>
                    <span className="status-text">{users.length} online</span>
                </div>
            </div>
        </div>
    );
}

export default PresenceBar;
