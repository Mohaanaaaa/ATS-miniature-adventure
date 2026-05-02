import React, { useState } from 'react';
import './AdminLogin.css';

const AdminLogin = ({ onLoginSuccess, onCancel }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = 'http://127.0.0.1:5000/api';

  const handleChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_access_level', data.access_level);
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="matrix-bg">
        <div className="code-rain"></div>
      </div>

      <div className="login-box">
        <div className="login-header">
          <h1>🔐 KUMARA HILLS VAULT</h1>
          <p>Master Admin Access Required</p>
        </div>

        {error && (
          <div className="error-alert">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter admin username"
              value={credentials.username}
              onChange={(e) => handleChange('username', e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter admin password"
              value={credentials.password}
              onChange={(e) => handleChange('password', e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              className="btn-login"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Authenticating...
                </>
              ) : (
                '🔓 Access Vault'
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#555'}
              onMouseOut={(e) => e.target.style.background = '#666'}
            >
              ✕ Cancel
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p className="hint">
            💡 Default credentials: admin / kp-vault-2026
          </p>
          <p className="warning">
            ⚠️ Change password on first login
          </p>
        </div>
      </div>

      <div className="login-backdrop"></div>
    </div>
  );
};

export default AdminLogin;