// ============================================================================
// AdminDashboard.js - Master Admin Control Panel
// Place this in: src/components/AdminDashboard.js
// ============================================================================

import React, { useState, useEffect } from 'react';
import './AdminDashboard.css'; // Import styles (provided below)

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, shops, alerts
  const [shops, setShops] = useState([]);
  const [stats, setStats] = useState(null);
  const [showShopForm, setShowShopForm] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  // --- NEW STATES FOR DASHBOARD LIST VIEW ---
  const [dashboardList, setDashboardList] = useState([]);
  const [listType, setListType] = useState(null); // 'ACTIVE', 'EMERGENCY', 'LOST_SIGNAL'
  const [isListLoading, setIsListLoading] = useState(false)

  const API_URL = 'http://127.0.0.1:5000/api';

  // Get auth header with token
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // ========== NEW: FETCH LIST DATA ==========
  const fetchCategoryData = async (type) => {
    setIsListLoading(true);
    setListType(type);
    try {
      // Endpoint to get trekkers by their safety status
      const res = await fetch(`${API_URL}/admin/trekkers?status=${type}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      setDashboardList(data.trekkers || []);
    } catch (err) {
      console.error('Error fetching list:', err);
    } finally {
      setIsListLoading(false);
    }
  };

  // ========== 1. DASHBOARD TAB ==========
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    }
  }, [activeTab]);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard/stats`, {
        headers: getHeaders()
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // ========== 2. SHOPS TAB ==========
  const fetchAllShops = async () => {
  setLoading(true);
  try {
    // Using the admin-specific route for full shop data
    const res = await fetch(`${API_URL}/admin/shops`, {
      headers: getHeaders()
    });
    
    const data = await res.json();
    
    if (res.ok) {
      // Admin route returns data inside a 'shops' property
      setShops(data.shops || []);
    } else {
      setAlertMessage(`❌ Failed to load shops: ${data.error}`);
    }
  } catch (err) {
    console.error('Error fetching shops:', err);
    setAlertMessage('❌ Connection error to shop database.');
  } finally {
    setLoading(false);
  }
  };
  useEffect(() => {
    if (activeTab === 'shops') {
      fetchAllShops();
    }
  }, [activeTab]);

  // ========== 3. REGISTER NEW SHOP ==========
  const [newShop, setNewShop] = useState({
    shop_name: '',
    shop_id: 'shop_',
    shop_location: { lat: 12.6654, lng: 75.6601 },
    contact_person: '',
    contact_phone: '',
    max_trekkers: 50
  });

  const handleShopFormChange = (field, value) => {
    setNewShop(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRegisterShop = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/shops/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newShop)
      });

      const data = await res.json();

      if (res.ok) {
        setAlertMessage(`✅ Shop "${newShop.shop_name}" registered successfully!`);
        setNewShop({
          shop_name: '',
          shop_id: 'shop_',
          shop_location: { lat: 12.6654, lng: 75.6601 },
          contact_person: '',
          contact_phone: '',
          max_trekkers: 50
        });
        setShowShopForm(false);
        fetchAllShops(); // Refresh the list
        setTimeout(() => setAlertMessage(''), 3000);
      } else {
        setAlertMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setAlertMessage(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ========== 4. BROADCAST ALERT ==========
  const [alertForm, setAlertForm] = useState({
    alert_type: 'WEATHER_WARNING',
    message: '',
    affected_shops: 'ALL'
  });

  const handleBroadcastAlert = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/alerts/broadcast`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(alertForm)
      });

      const data = await res.json();

      if (res.ok) {
        setAlertMessage(`📢 Alert broadcasted: "${alertForm.message}"`);
        setAlertForm({
          alert_type: 'WEATHER_WARNING',
          message: '',
          affected_shops: 'ALL'
        });
        setTimeout(() => setAlertMessage(''), 4000);
      } else {
        setAlertMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setAlertMessage(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-dashboard">
      {/* ========== HEADER ========== */}
      <header className="admin-header">
        <div className="admin-title">
          <h1>🔐 Master Admin Control Vault</h1>
          <p>Kumara Hills Trek System - Global Command Center</p>
        </div>
        <div className="admin-user-info">
          <span className="admin-status">🟢 MASTER ADMIN ACTIVE</span>
          <button onClick={onLogout} className="btn-logout">Logout</button>
        </div>
      </header>

      {/* ========== ALERT MESSAGE ========== */}
      {alertMessage && (
        <div className="alert-banner">
          {alertMessage}
        </div>
      )}

      {/* ========== TAB NAVIGATION ========== */}
      <nav className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'shops' ? 'active' : ''}`}
          onClick={() => setActiveTab('shops')}
        >
          🏕️ Shop Management
        </button>
        <button
          className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          📢 Global Alerts
        </button>
      </nav>

      {/* ========== TAB CONTENT ========== */}
      <div className="admin-content">
        
        {/* --- DASHBOARD TAB --- */}
        {activeTab === 'dashboard' && (
          <section className="dashboard-tab">
            <h2>System Overview</h2>
            {stats ? (
              <div className="stats-grid">
                {/* --- CLICKABLE ACTIVE TREKKERS --- */}
                <div 
                  className={`stat-card clickable ${listType === 'ACTIVE' ? 'active-ring' : ''}`}
                  onClick={() => fetchCategoryData('ACTIVE')}
                >
                  <div className="stat-value">{stats.total_active_trekkers}</div>
                  <div className="stat-label">Active Trekkers</div>
                </div>

                <div className="stat-card">
                  <div className="stat-value">{stats.total_shops}</div>
                  <div className="stat-label">Registered Shops</div>
                </div>

                {/* --- CLICKABLE EMERGENCY ALERTS --- */}
                <div 
                  className={`stat-card clickable critical ${listType === 'EMERGENCY' ? 'active-ring' : ''}`}
                  onClick={() => fetchCategoryData('EMERGENCY')}
                >
                  <div className="stat-value" style={{ color: stats.emergency_alerts > 0 ? '#dc3545' : '#28a745' }}>
                    {stats.emergency_alerts}
                  </div>
                  <div className="stat-label">🚨 Emergency Alerts</div>
                </div>

                {/* --- CLICKABLE LOST SIGNALS --- */}
                <div 
                  className={`stat-card clickable warning ${listType === 'LOST_SIGNAL' ? 'active-ring' : ''}`}
                  onClick={() => fetchCategoryData('LOST_SIGNAL')}
                >
                  <div className="stat-value">{stats.lost_signals}</div>
                  <div className="stat-label">⚠️ Lost Signals</div>
                </div>
              </div>
            ) : <div className="loading">Loading stats...</div>}

            {/* ========== NEW: DRILL-DOWN DATA TABLE ========== */}
            {/* ========== DRILL-DOWN DATA TABLE ========== */}
            {listType && (
              <div className="dashboard-list-container">
                <div className="list-header">
                  <h3>📋 {listType.replace('_', ' ')} TREKKERS DATA</h3>
                  <button className="btn-close-list" onClick={() => setListType(null)}>✕ Close</button>
                </div>
                
                {isListLoading ? (
                  <div className="loading">Fetching records...</div>
                ) : (
                  <div className="table-wrapper">
                    {dashboardList.length > 0 ? (
                      <table className="vault-table">
                        <thead>
                          <tr>
                            <th>Trekker Name</th>
                            <th>Registered Shop</th>
                            <th>Band ID</th>
                            <th>Contact</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardList.map((t) => (
                            <tr key={t.id || t.band_id}>
                              <td><strong>{t.name}</strong></td>
                              <td>{t.shop_name || "N/A"}</td>
                              <td><code>{t.band_id}</code></td>
                              <td>{t.emergency_contact || t.phone}</td>
                              <td>
                                <span className={`status-pill ${t.status?.toLowerCase()}`}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="no-data-notice">
                        <p>No detailed records found for <strong>{listType}</strong>.</p>
                        <p>Check if the trekker session was started correctly in the shop dashboard.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="system-status">
              <h3>System Status</h3>
              <div className="status-badge" style={{ backgroundColor: '#28a745' }}>
                ✓ OPERATIONAL
              </div>
              <p>All systems functioning normally. Last update: {new Date().toLocaleTimeString()}</p>
            </div>
          </section>
        )}

        {/* --- SHOP MANAGEMENT TAB --- */}
        {activeTab === 'shops' && (
          <section className="shops-tab">
            <div className="shops-header">
              <h2>🏕️ Shop Management</h2>
              <button
                className="btn-primary"
                onClick={() => setShowShopForm(!showShopForm)}
              >
                {showShopForm ? '✕ Cancel' : '+ Register New Shop'}
              </button>
            </div>

            {/* Registration Form */}
            {showShopForm && (
              <div className="shop-form-container">
                <h3>Register New Shop/Base Camp</h3>
                <form onSubmit={handleRegisterShop}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Shop ID *</label>
                      <input
                        type="text"
                        placeholder="e.g., shop_01, shop_02"
                        value={newShop.shop_id}
                        onChange={(e) => handleShopFormChange('shop_id', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Shop Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Kukke Base Camp"
                        value={newShop.shop_name}
                        onChange={(e) => handleShopFormChange('shop_name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Person *</label>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={newShop.contact_person}
                        onChange={(e) => handleShopFormChange('contact_person', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Phone *</label>
                      <input
                        type="tel"
                        placeholder="+91-98765432xx"
                        value={newShop.contact_phone}
                        onChange={(e) => handleShopFormChange('contact_phone', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={newShop.shop_location.lat}
                        onChange={(e) => setNewShop(prev => ({
                          ...prev,
                          shop_location: { ...prev.shop_location, lat: parseFloat(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={newShop.shop_location.lng}
                        onChange={(e) => setNewShop(prev => ({
                          ...prev,
                          shop_location: { ...prev.shop_location, lng: parseFloat(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Max Trekkers</label>
                      <input
                        type="number"
                        value={newShop.max_trekkers}
                        onChange={(e) => handleShopFormChange('max_trekkers', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Registering...' : 'Register Shop'}
                  </button>
                </form>
              </div>
            )}

            {/* Shops List - Table View */}
            <div className="shops-list">
            <div className="list-header-flex">
              <h3>Registered Shops ({shops.length})</h3>
            </div>

            {shops.length === 0 ? (
              <p className="no-data">No shops registered yet. Create one to get started.</p>
            ) : (
              <div className="table-wrapper">
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th>Shop Name</th>
                      <th>Shop ID</th>
                      <th>Contact Person</th>
                      <th>Phone</th>
                      <th>Capacity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shops.map((shop) => (
                      <tr key={shop.shop_id}>
                        <td><strong>{shop.shop_name}</strong></td>
                        <td><code>{shop.shop_id}</code></td>
                        <td>{shop.contact_person}</td>
                        <td>{shop.contact_phone}</td>
                        <td>{shop.max_trekkers} trekkers</td>
                        <td>
                          <span className={`status-pill ${shop.is_active ? 'active' : 'inactive'}`}>
                            {shop.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </section>
        )}

        {/* --- ALERTS TAB --- */}
        {activeTab === 'alerts' && (
          <section className="alerts-tab">
            <h2>📢 Global Alert Broadcasting</h2>
            
            <div className="alert-form-container">
              <h3>Broadcast System-Wide Alert</h3>
              <form onSubmit={handleBroadcastAlert}>
                <div className="form-group">
                  <label>Alert Type *</label>
                  <select
                    value={alertForm.alert_type}
                    onChange={(e) => setAlertForm(prev => ({
                      ...prev,
                      alert_type: e.target.value
                    }))}
                  >
                    <option value="WEATHER_WARNING">⛈️ Weather Warning</option>
                    <option value="EVACUATION">🚨 Evacuation Order</option>
                    <option value="MEDICAL_ALERT">🏥 Medical Alert</option>
                    <option value="LOST_SIGNAL">📡 Lost Signal Alert</option>
                    <option value="ALL_CLEAR">✓ All Clear</option>
                    <option value="CUSTOM">Custom Message</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Message *</label>
                  <textarea
                    placeholder="Enter alert message to broadcast to all shops..."
                    rows="4"
                    value={alertForm.message}
                    onChange={(e) => setAlertForm(prev => ({
                      ...prev,
                      message: e.target.value
                    }))}
                    required
                  ></textarea>
                </div>

                <div className="form-group">
                  <label>Affected Shops</label>
                  <select
                    value={alertForm.affected_shops}
                    onChange={(e) => setAlertForm(prev => ({
                      ...prev,
                      affected_shops: e.target.value
                    }))}
                  >
                    <option value="ALL">🌍 All Shops</option>
                    <option value="CRITICAL">🔴 Critical Zone Shops Only</option>
                    {/* Add specific shops dynamically */}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-danger"
                  disabled={loading || !alertForm.message}
                >
                  {loading ? 'Broadcasting...' : '📢 Broadcast Alert'}
                </button>
              </form>
            </div>

            <div className="alert-info">
              <h3>⚠️ Alert Broadcasting Guidelines</h3>
              <ul>
                <li>Use EVACUATION only in genuine emergencies</li>
                <li>Alerts are sent to all active shops immediately</li>
                <li>Include specific location/time details in message</li>
                <li>Follow up with ALL_CLEAR when situation resolves</li>
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;