// ============================================================================
// AdminDashboard.js - Unified Administration Management Panel with CRUD
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react'; 
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

  // Shop Registration Form State
  const [shopForm, setShopForm] = useState({
    shop_id: '', shop_name: '', contact_person: '', contact_phone: '', max_trekkers: 50
  });

  // 🔄 FETCH AUTO-INCREMENT ID FOR NEW REGISTERING SHOPS
  useEffect(() => {
    if (showShopForm && !isEditing) {
      fetch('http://127.0.0.1:5000/api/admin/shops/next-id', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.next_shop_id) {
          setShopForm(prev => ({ ...prev, shop_id: data.next_shop_id }));
        }
      })
      .catch(err => console.error("Error auto-fetching next shop registration sequence matrix ID:", err));
    }
  }, [showShopForm, isEditing, token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) { console.error(err); }
  }, [token]);

  const fetchShops = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/admin/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setShops(data.shops || []);
    } catch (err) { console.error(err); }
  }, [token]);

  useEffect(() => {
    fetchStats();
    fetchShops();
  }, [fetchStats, fetchShops]);

  // Handle viewing specific shop trekker records
  const viewShopTrekkers = async (shopId, shopName) => {
  setSelectedShopId(shopId);
  setSelectedShopName(shopName);
  setIsTrekkersLoading(true);
  try {
    const response = await fetch(`http://127.0.0.1:5000/api/admin/shops/${shopId}/trekkers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 🌟 ADDED: Send the admin authentication token to bypass the backend blocker
        'Authorization': `Bearer ${token}` 
      }
    });

    if (response.ok) {
      const data = await response.json();
      setShopTrekkersList(data);
    } else {
      console.error("Backend validation failed or unauthorized access.");
      setShopTrekkersList([]);
    }
  } catch (error) {
    console.error("Network synchronization error fetching station trekkers:", error);
    setShopTrekkersList([]);
  } finally {
    setIsTrekkersLoading(false);
  }
};

  const fetchDashboardList = async (type) => {
    setListType(type);
    setIsListLoading(true);
    setDashboardList([]);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/trekkers?status=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardList(data);
      }
    } catch (err) {
      console.error("Failed fetching dashboard status metrics list row views:", err);
    } finally {
      setIsListLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setShopForm({ shop_id: '', shop_name: '', contact_person: '', contact_phone: '', max_trekkers: 50 });
    setShowShopForm(true);
  };

  const handleOpenEditModal = (shop) => {
    setIsEditing(true);
    setShopForm({
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      contact_person: shop.contact_person,
      contact_phone: shop.contact_phone || '',
      max_trekkers: shop.max_trekkers || 50
    });
    setShowShopForm(true);
  };

  const handleDeleteShop = async (shopId) => {
    if (!window.confirm(`Are you sure you want to permanently delete Hub Station ${shopId}?`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/admin/shops/${shopId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchShops();
        fetchStats();
        if (selectedShopId === shopId) setSelectedShopId(null);
      } else {
        const errData = await res.json();
        alert(errData.error || "Delete call rejected.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = isEditing 
      ? `http://127.0.0.1:5000/api/admin/shops/${shopForm.shop_id}`
      : 'http://127.0.0.1:5000/api/admin/shops';

    const methodType = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method: methodType,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(shopForm)
      });
      if (res.ok) {
        setShowShopForm(false);
        fetchShops();
        fetchStats();
      } else {
        const errPayload = await res.json();
        alert(errPayload.error || "Form commit action rejected.");
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Administrative System Control Matrix</h1>
        <button className="logout-btn" onClick={onLogout}>✕ Close Vault Session</button>
      </div>

      <div className="dashboard-tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📈 System Analytics Monitoring Overview</button>
        <button className={activeTab === 'shops' ? 'active' : ''} onClick={() => setActiveTab('shops')}>🏪 Station Hub Management Node Panel</button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="dashboard-content">
          <div className="stats-strip">
            <div className="stat-card blue" >
              <h3>Active Base Stations</h3>
              <p className="stat-number">{stats.total_shops}</p>
            </div>
            <div className="stat-card green" onClick={() => fetchDashboardList('ACTIVE')}>
              <h3>Live Trekkers Onboarded</h3>
              <p className="stat-number">{stats.total_active_trekkers}</p>
            </div>
            <div className="stat-card red" onClick={() => fetchDashboardList('EMERGENCY')}>
              <h3>Active SOS Air Alerts</h3>
              <p className="stat-number">{stats.emergency_alerts}</p>
            </div>
            <div className="stat-card orange" onClick={() => fetchDashboardList('LOST_SIGNAL')}>
              <h3>Lost Radio Signals (&gt;10m)</h3>
              <p className="stat-number">{stats.lost_signals}</p>
            </div>
          </div>

          {listType && (
            <div className="dashboard-list-section" style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ textTransform: 'uppercase', fontSize: '16px', color: '#333' }}>Registry Filter: {listType} Records</h2>
                <button onClick={() => setListType(null)} style={{ padding: '4px 10px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Clear List</button>
              </div>

              {isListLoading ? (
                <p>Querying cluster telemetry loops...</p>
              ) : dashboardList.length === 0 ? (
                <p style={{ color: '#888' }}>No active records currently match this filter criteria.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '12px' }}>Trekker Name</th>
                      <th style={{ padding: '12px' }}>Band ID</th>
                      <th style={{ padding: '12px' }}>Station ID Node</th>
                      <th style={{ padding: '12px' }}>Emergency Contact Support</th>
                      <th style={{ padding: '12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardList.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.name}</td>
                        <td style={{ padding: '12px' }}><code>{item.band_id}</code></td>
                        <td style={{ padding: '12px' }}>{item.shop_name}</td>
                        <td style={{ padding: '12px' }}>{item.emergency_contact}</td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge ${item.status?.toLowerCase()}`} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {item.status}
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

            {activeTab === 'shops' && (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h2 style={{ margin: 0 }}>Registered Station Hubs</h2>
      <button 
        style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        onClick={handleOpenCreateModal}
      >
        ➕ Provision New Station Hub
      </button>
    </div>

    {/* Main Station Shop Data Grid */}
    <div className="table-responsive" style={{ marginBottom: '32px' }}>
      <table className="shops-table">
        <thead>
          <tr>
            <th>Shop ID</th>
            <th>Station Name</th>
            <th>Contact Person</th>
            <th>Contact Vector</th>
            <th>Max Capacity</th>
            <th style={{ textAlign: 'center' }}>System Management Routing</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.shop_id}>
              <td style={{ fontWeight: 'bold', color: '#4a5568' }}>{shop.shop_id}</td>
              <td>{shop.shop_name}</td>
              <td>{shop.contact_person}</td>
              <td>{shop.contact_phone || 'N/A'}</td>
              <td>{shop.max_trekkers} Assets</td>
              <td style={{ textAlign: 'center' }}>
                <button 
                  style={{ marginRight: '8px', padding: '6px 12px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  onClick={() => viewShopTrekkers(shop.shop_id, shop.shop_name)}
                >
                  🔍 View Trekkers
                </button>
                <button 
                  style={{ marginRight: '8px', padding: '6px 12px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  onClick={() => handleOpenEditModal(shop)}
                >
                  ✏️ Edit
                </button>
                <button 
                  style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  onClick={() => handleDeleteShop(shop.shop_id)}
                >
                  🗑️ Purge
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* 🌟 INLINE POSITIONING: Registered Trekker Details Segment below table */}
    {selectedShopId && (
      <div className="stat-card" style={{ borderLeft: '5px solid #17a2b8', background: '#ffffff', padding: '24px', borderRadius: '8px', marginTop: '24px', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', textTransform: 'none', letterSpacing: 'normal' }}>
              Live Registrations for Station: <span style={{ color: '#17a2b8' }}>{selectedShopName}</span> ({selectedShopId})
            </h3>
          </div>
          <button 
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', color: '#64748b', fontWeight: '600' }}
            onClick={() => { setSelectedShopId(null); setShopTrekkersList([]); }}
          >
            ✕ Dismiss View
          </button>
        </div>

        {isTrekkersLoading ? (
          <p style={{ color: '#64748b', fontStyle: 'italic' }}>Syncing local grid with active station telemetry...</p>
        ) : shopTrekkersList.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>💡 No active trackers matched to this station profile channel currently.</p>
        ) : (
          <div className="table-responsive">
            <table className="shops-table">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Trip Profile ID</th>
                  <th style={{ fontWeight: '600' }}>Shop ID</th>
                  <th>Trekker Signature Name</th>
                  <th>Hardware Node Band ID</th>
                  <th>Emergency Network Contact</th>
                  <th>Status Monitor Matrix</th>
                </tr>
              </thead>
              <tbody>
                {shopTrekkersList.map((trekker) => (
                  <tr key={trekker.id}>
                    <td>#{trekker.id}</td>
                    {/* 🌟 FIXED: Changed {shopId.shop_id} to use either the item's field or the selected state */}
                    <td style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {trekker.shop_id || selectedShopId}
                    </td>
                    <td style={{ fontWeight: '600' }}>{trekker.name}</td>
                    <td><span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{trekker.band_id}</span></td>
                    <td>{trekker.emergency_contact}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: trekker.status === 'EMERGENCY' ? '#fde8e8' : trekker.status === 'LOST_SIGNAL' ? '#fef3c7' : '#e6fffa',
                        color: trekker.status === 'EMERGENCY' ? '#9b1c1c' : trekker.status === 'LOST_SIGNAL' ? '#92400e' : '#047487'
                      }}>
                        {trekker.status}
                      </span>
                    </td>
                  </tr>
                                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
  </div>
)}
      {showShopForm && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000 }}>
          <div className="modal-card" style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '450px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              {isEditing ? `Modify Database Properties: ${shopForm.shop_id}` : 'Commit Base Checkpoint to Core System'}
            </h2>
            <form onSubmit={handleShopSubmit}>
              {/* 📊 FIXED: SHOP ID FIELD IS NOW VISIBLE AND GENERATED PROPERLY */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Station Access Identifier Key ID:</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px' }} 
                  value={shopForm.shop_id} 
                  readOnly 
                  required 
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Operational Station Name:</label>
                <input type="text" placeholder="Bhattara Mane Checkpoint" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.shop_name} onChange={e => setShopForm({ ...shopForm, shop_name: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Ranger Head Authority Name:</label>
                <input type="text" placeholder="Officer in Charge" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.contact_person} onChange={e => setShopForm({ ...shopForm, contact_person: e.target.value })} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Emergency Satellite Radio Contact Line:</label>
                <input type="text" placeholder="Contact link or number" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.contact_phone} onChange={e => setShopForm({ ...shopForm, contact_phone: e.target.value })} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Max Concurrent Trekkers:</label>
                <input type="number" placeholder="50" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} value={shopForm.max_trekkers} onChange={e => setShopForm({ ...shopForm, max_trekkers: parseInt(e.target.value) || 50 })} />
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
  
  )};

export default AdminDashboard;