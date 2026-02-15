import React, { useEffect } from 'react';
import './Toast.css';

function Toast({ toasts, removeToast }) {
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                >
                    <div className="toast-content">
                        {toast.type === 'join' && <span className="toast-icon">✓</span>}
                        {toast.type === 'leave' && <span className="toast-icon">—</span>}
                        <span className="toast-message">{toast.message}</span>
                    </div>
                    <div className="toast-progress"></div>
                </div>
            ))}
        </div>
    );
}

export default Toast;
