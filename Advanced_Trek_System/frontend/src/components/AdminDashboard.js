// ============================================================================
// AdminDashboard.js - Unified Administration Management Panel with CRUD
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react'; // 1. Added useCallback importimport './AdminDashboard.css';
import './AdminDashboard.css';

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, shops, alerts
  const [shops, setShops] = useState([]);
  const [stats, setStats] = useState({ total_shops: 0, total_active_trekkers: 0, emergency_alerts: 0, lost_signals: 0 });
  const [showShopForm, setShowShopForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Tracks if modal is in edit state
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('admin_token');

  // Unified Monitoring Table Hooks
  const [dashboardList, setDashboardList] = useState([]);
  const [listType, setListType] = useState(null); // ACTIVE, EMERGENCY, LOST_SIGNAL
  const [isListLoading, setIsListLoading] = useState(false);

  // New states for checking trekker details per specific shop station hub
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [selectedShopName, setSelectedShopName] = useState('');
  const [shopTrekkersList, setShopTrekkersList] = useState([]);
  const [isTrekkersLoading, setIsTrekkersLoading] = useState(false);

  // Clean Shop Registry Hook matching your precise models.py JSON requirements
  const [shopForm, setShopForm] = useState({
    shop_id: '',
    shop_name: '',
    contact_person: '',
    contact_phone: '',
    max_trekkers: 50,
    lat: 12.6654,
    lng: 75.6601
  });

  const API_URL = 'http://127.0.0.1:5000/api';

  const getHeaders = useCallback(() => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
}), [token]); // Re-evaluates only if your admin token updates

  // ========== DATA SYNC PIPELINES ==========
  // 2. Add getHeaders to the fetchDashboardStats dependency array
const fetchDashboardStats = useCallback(async () => {
  try {
    const res = await fetch(`${API_URL}/admin/dashboard/stats`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  } catch (err) {
    console.error("Failed to load metrics scorecard:", err);
  }
}, [API_URL, getHeaders]); // Updated dependencies cleanly

// 3. Add getHeaders to the fetchAllShops dependency array
const fetchAllShops = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch(`${API_URL}/vault/comprehensive`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      const incomingShops = data.shops || [];
      setShops(incomingShops);
      
      setStats(prev => ({
        ...prev,
        total_shops: incomingShops.length
      }));
    }
  } catch (err) {
    console.error("Shop lookup connection breakdown:", err);
  } finally {
    setLoading(false);
  }
}, [API_URL, getHeaders]); // Updated dependencies cleanly

  const fetchCategorizedTrekkers = async (status) => {
    setIsListLoading(true);
    setListType(status);
    try {
      const res = await fetch(`${API_URL}/admin/trekkers?status=${status}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDashboardList(data);
      }
    } catch (err) {
      console.error("Error updating categorical vectors:", err);
    } finally {
      setIsListLoading(false);
    }
  };

  // Fetches all registered trekkers tied to a specific base station shop
  const fetchTrekkersByShop = async (shopId, shopName) => {
    setIsTrekkersLoading(true);
    setSelectedShopId(shopId);
    setSelectedShopName(shopName);
    try {
      const res = await fetch(`${API_URL}/admin/shops/${shopId}/trekkers`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setShopTrekkersList(data || []);
      } else {
        setShopTrekkersList([]);
      }
    } catch (err) {
      console.error("Error pulling shop trekker manifest metadata:", err);
      setShopTrekkersList([]);
    } finally {
      setIsTrekkersLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (activeTab === 'shops') {
      fetchAllShops();
      setSelectedShopId(null);
      setShopTrekkersList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // AUTOMATED NEW CREATION TRIGGER
  const handleOpenShopModal = async () => {
    setIsEditing(false)
    try {
      const res = await fetch(`${API_URL}/admin/next-shop-id`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setShopForm({
          shop_id: data.next_id,
          shop_name: '',
          contact_person: '',
          contact_phone: '',
          max_trekkers: 50,
          lat: 12.6654,
          lng: 75.6601
        });
      }
    } catch (err) {
      console.error("Failed to fetch auto-generated shop ID prefix:", err);
    }
    setShowShopForm(true);
  };

  // ========== CRUD OPERATION HANDLERS ==========

  // 1. Populate current values for Editing
  const handleEditClick = (shop) => {
    setIsEditing(true);
    setShopForm({
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      contact_person: shop.contact_person,
      contact_phone: shop.contact_phone,
      max_trekkers: shop.max_trekkers,
      lat: shop.shop_location?.lat || 12.6654,
      lng: shop.shop_location?.lng || 75.6601
    });
    setShowShopForm(true);
  };

  // 2. Dispatch Delete request to backend
  const handleDeleteClick = async (shopId) => {
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete Station ${shopId}?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/shops/delete/${shopId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        alert('Station successfully removed from database.');
        if (selectedShopId === shopId) {
          setSelectedShopId(null);
          setShopTrekkersList([]);
        }
        fetchAllShops();
        fetchDashboardStats();
      } else {
        const data = await res.json();
        alert(`Deletion Failed: ${data.error}`);
      }
    } catch (err) {
      alert('Network transmission failed during structural deletion routine.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Form submission Router (Creates or Updates depending on isEditing status)
  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      shop_id: shopForm.shop_id,
      shop_name: shopForm.shop_name,
      contact_person: shopForm.contact_person,
      contact_phone: shopForm.contact_phone,
      max_trekkers: parseInt(shopForm.max_trekkers),
      shop_location: {
        lat: parseFloat(shopForm.lat),
        lng: parseFloat(shopForm.lng)
      }
    };

    const endpoint = isEditing 
      ? `${API_URL}/admin/shops/update/${shopForm.shop_id}` 
      : `${API_URL}/admin/shops/register`;

    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        alert(isEditing ? 'Station profile configurations successfully updated!' : 'Station successfully registered!');
        setShowShopForm(false);
        fetchAllShops();
        fetchDashboardStats();
      } else {
        alert(`Registry Mutation Refused: ${data.error}`);
      }
    } catch (err) {
      alert('Network transmission failed during database save routine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h2>🔒 MASTER ADMIN CENTRAL VAULT</h2>
        <div className="nav-tabs">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => { setActiveTab('dashboard'); setListType(null); }}>
            System Monitor
          </button>
          <button className={activeTab === 'shops' ? 'active' : ''} onClick={() => setActiveTab('shops')}>
            Shop Management
          </button>
          <button onClick={onLogout} className="logout-btn">Exit Vault</button>
        </div>
      </header>

      <div className="dashboard-content">
        
        {/* TAB 1: SYSTEM INTEGRATION MONITOR */}
        {activeTab === 'dashboard' && (
          <>
            <div className="stats-grid">
              <div className="stat-card blue">
                <h3>Total Stations</h3>
                <p className="stat-value">{stats.total_shops}</p>
              </div>
              <div className={`stat-card green ${listType === 'ACTIVE' ? 'selected-card' : ''}`} onClick={() => fetchCategorizedTrekkers('ACTIVE')}>
                <h3>Active Trekkers 💓</h3>
                <p className="stat-value">{stats.total_active_trekkers}</p>
              </div>
              <div className={`stat-card red ${listType === 'EMERGENCY' ? 'selected-card' : ''}`} onClick={() => fetchCategorizedTrekkers('EMERGENCY')}>
                <h3>Emergency Alerts 🚨</h3>
                <p className="stat-value">{stats.emergency_alerts}</p>
              </div>
              <div className={`stat-card grey ${listType === 'LOST_SIGNAL' ? 'selected-card' : ''}`} onClick={() => fetchCategorizedTrekkers('LOST_SIGNAL')}>
                <h3>Lost Signals ⚠️</h3>
                <p className="stat-value">{stats.lost_signals}</p>
              </div>
            </div>

            {listType && (
              <div className="table-container live-telemetry-block">
                <h3>Live Network Activity Log: [{listType}]</h3>
                {isListLoading ? (
                  <p>Streaming telemetric rows from active bands...</p>
                ) : (
                  <table className="vault-table">
                    <thead>
                      <tr>
                        <th>Trip ID</th>
                        <th>Operator</th>
                        <th>Band ID</th>
                        <th>Assigned Station</th>
                        <th>Heart Rate</th>
                        <th>Device Battery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardList.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', color: '#6c757d' }}>No tracking records map to this monitoring condition right now.</td></tr>
                      ) : (
                        dashboardList.map(t => (
                          <tr key={t.id}>
                            <td>#{t.id}</td>
                            <td><strong>{t.name}</strong></td>
                            <td><code>{t.band_id}</code></td>
                            <td>{t.shop_name || 'N/A'}</td>
                            <td style={{ fontWeight: 'bold', color: t.status === 'EMERGENCY' ? '#dc3545' : '#28a745' }}>💓 {t.pulse} BPM</td>
                            <td>{t.battery}% Remaining</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
        {/* TAB 2: SHOP REGISTER WORKSPACE */}
        {activeTab === 'shops' && (
          <div className="table-container" style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Registered Persistent Stations ({shops.length})</h3>
              <button onClick={handleOpenShopModal} style={{ padding: '10px 15px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                + Register New Shop Hub
              </button>
            </div>

            <table className="vault-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px' }}>Station ID</th>
                  <th style={{ padding: '12px' }}>Shop Name</th>
                  <th style={{ padding: '12px' }}>Supervisor</th>
                  <th style={{ padding: '12px' }}>Contact Phone</th>
                  <th style={{ padding: '12px' }}>Max Capacity</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Control Actions</th>
                </tr>
              </thead>
              <tbody>
                {shops.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '15px', textAlign: 'center', color: '#6c757d' }}>No persistent shop rows exist within your SQLite database.</td></tr>
                ) : (
                  shops.map(shop => (
                    <tr key={shop.shop_id} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: selectedShopId === shop.shop_id ? '#f0f7ff' : 'transparent' }}>
                      <td style={{ padding: '12px' }}><code>{shop.shop_id}</code></td>
                      <td style={{ padding: '12px' }}><strong>{shop.shop_name}</strong></td>
                      <td style={{ padding: '12px' }}>{shop.contact_person}</td>
                      <td style={{ padding: '12px' }}>{shop.contact_phone}</td>
                      <td style={{ padding: '12px' }}>{shop.max_trekkers} Allowed</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {/* 🔍 ADDED: Detailed registry viewer lookup option link */}
                        <button onClick={() => fetchTrekkersByShop(shop.shop_id, shop.shop_name)} style={{ padding: '5px 10px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          🔍 Details
                        </button>
                        <button onClick={() => handleEditClick(shop)} style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDeleteClick(shop.shop_id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* DYNAMIC SUB-TABLE PANEL: Displays trekkers registered at the selected base station */}
            {selectedShopId && (
              <div className="shop-trekkers-details-block" style={{ marginTop: '30px', padding: '20px', border: '1px solid #bee5eb', backgroundColor: '#f8fdfd', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: '#0c5460' }}>📋 Registered Trekker Manifest: <span style={{ textDecoration: 'underline' }}>{selectedShopName}</span> ({selectedShopId})</h4>
                  <button onClick={() => { setSelectedShopId(null); setShopTrekkersList([]); }} style={{ padding: '4px 10px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    ✕ Close Details
                  </button>
                </div>

                {isTrekkersLoading ? (
                  <p style={{ color: '#6c757d', fontSize: '13px' }}>Querying active trail roster rows...</p>
                ) : shopTrekkersList.length === 0 ? (
                  <p style={{ color: '#6c757d', fontSize: '13px', margin: 0, padding: '10px 0' }}>No trekkers have registered at this base station checkpoint yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', backgroundColor: '#ffffff' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#eef9fa', borderBottom: '1px solid #bee5eb' }}>
                        <th style={{ padding: '10px' }}>Trekker ID</th>
                        <th style={{ padding: '10px' }}>Trekker Name</th>
                        <th style={{ padding: '10px' }}>Hardware Band ID</th>
                        <th style={{ padding: '10px' }}>Emergency Phone Contact</th>
                        <th style={{ padding: '10px' }}>Trail Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shopTrekkersList.map(trekker => (
                        <tr key={trekker.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px' }}>#{trekker.id}</td>
                          <td style={{ padding: '10px' }}><strong>{trekker.name}</strong></td>
                          <td style={{ padding: '10px' }}><code>{trekker.reg_id || trekker.band_id || 'N/A'}</code></td>
                          <td style={{ padding: '10px' }}>{trekker.emergency_contact || 'None'}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              backgroundColor: trekker.is_active ? '#d4edda' : '#e2e8f0',
                              color: trekker.is_active ? '#155724' : '#495057'
                            }}>
                              {trekker.is_active ? 'ON TRAIL' : 'COMPLETED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* POPUP REGISTRATION / EDIT FORM OVERLAY */}
        {showShopForm && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="modal-content" style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '400px' }}>
              <h3 style={{ marginBottom: '20px' }}>
                {isEditing ? `⚙️ Edit Base Camp: ${shopForm.shop_id}` : 'Register New Base Camp Station'}
              </h3>
              <form onSubmit={handleShopSubmit}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Station ID Prefix (Auto-Managed):</label>
                  <input 
                    type="text" 
                    required 
                    readOnly
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#e9ecef', color: '#495057', cursor: 'not-allowed', fontWeight: 'bold', border: '1px solid #ced4da' }} 
                    value={shopForm.shop_id} 
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Friendly Shop Name:</label>
                  <input type="text" placeholder="Enter registration name" required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.shop_name} onChange={e => setShopForm({ ...shopForm, shop_name: e.target.value })} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Supervisor/Contact Person:</label>
                  <input type="text" placeholder="Full name" required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.contact_person} onChange={e => setShopForm({ ...shopForm, contact_person: e.target.value })} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Contact Phone:</label>
                  <input type="text" placeholder="Mobile connection line" required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.contact_phone} onChange={e => setShopForm({ ...shopForm, contact_phone: e.target.value })} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Max Concurrent Trekkers:</label>
                  <input type="number" placeholder="50" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.max_trekkers} onChange={e => setShopForm({ ...shopForm, max_trekkers: e.target.value })} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <button type="submit" disabled={loading} style={{ padding: '10px 25px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {loading ? 'Saving...' : isEditing ? 'Update DB Row' : 'Commit to DB'}
                  </button>
                  <button type="button" style={{ padding: '10px 25px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setShowShopForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;