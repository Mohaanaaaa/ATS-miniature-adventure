import React, { useState, useEffect } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, Polyline, 
  CircleMarker, Tooltip, Circle, LayerGroup 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

// --- CUSTOM ICONS ---
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const greyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const MainTracker = () => {
  const navigate = useNavigate();
  const [trekkers, setTrekkers] = useState([]);
  const [mapConfig, setMapConfig] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 🏪 DYNAMIC REGISTERED SHOPS STATE HOOK
  const [registeredShops, setRegisteredShops] = useState([]);

  // Onboard Form State Variables 
  const [formData, setFormData] = useState({
    name: '',
    reg_id: '',
    emergency_contact: '',
    shop_id: '' // Kept clean to dynamic auto-select first row
  });
  // Popup state for checkpoint details (if needed in future expansion)
  const [showPopup, setShowPopup] = useState(false);

  const API_BASE = 'http://127.0.0.1:5000/api';

  // 📥 FETCH REGISTERED CHECKPOINTS/SHOPS MATRIX FROM BACKEND
  useEffect(() => {
    fetch(`${API_BASE}/admin/shops`)
      .then(res => res.json())
      .then(data => {
        const shopsList = data.shops || [];
        setRegisteredShops(shopsList);
        if (shopsList.length > 0) {
          setFormData(prev => ({ ...prev, shop_id: shopsList[0].shop_id }));
        }
      })
      .catch(err => console.error("Error pulling live station dropdown arrays:", err));
  }, []);

  // --- DATABASE INITIALIZATION EFFECT FOR ACTIVE TRACKERS AND STATIONS ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Fetch live active trekkers for mapping coordinates
        const trekkersRes = await fetch('http://127.0.0.1:5000/api/active_trekkers');
        if (trekkersRes.ok) {
          const trekkersData = await trekkersRes.json();
          setTrekkers(trekkersData);
        }

        // 2. 🌟 FIXED: Fetch the active list of station checkpoints dynamically from the backend
        const shopsRes = await fetch('http://127.0.0.1:5000/api/shops');
        if (shopsRes.ok) {
          const shopsData = await shopsRes.json();
          setRegisteredShops(shopsData); // Populates the selector dropdown
        }
      } catch (err) {
        console.error("Matrix synchronization connection error:", err);
      }
    };

    fetchInitialData();
    const interval = setInterval(fetchInitialData, 10000); // Polling every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Map config loading cycle geometry configurations
  useEffect(() => {
    fetch(`${API_BASE}/map_config`)
      .then(res => {
        if (!res.ok) throw new Error('Failed core map init properties');
        return res.json();
      })
      .then(data => setMapConfig(data))
      .catch(err => console.error(err));
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccessMsg('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!formData.name.trim() || !formData.reg_id.trim() || !formData.emergency_contact.trim()) {
      setError('All metadata tracking fields are required');
      setLoading(false);
      return;
    }

    if (!/^\d{13}$/.test(formData.reg_id)) {
      setError('Hardware node registration ID must be exactly 13 digits');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/start_trek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration sequence interrupted');
      }

      setSuccessMsg(`Node initialized successfully! ID assigned.`);
      setFormData(prev => ({
        ...prev,
        name: '',
        reg_id: '',
        emergency_contact: '',
        shop_id: selectedShop => prev.shop_id // Retains current shop selection for next registration
        // keeps previous shop selection intact
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (bandId) => {
    if (!window.confirm(`Release and archive node tracking session #${bandId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/end_trek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ band_id: bandId })
      });
      if (res.ok) {
        setSuccessMsg(`Band hardware matrix target ${bandId} released clean.`);
        setTrekkers(prev => prev.filter(t => t.band_id !== bandId));
      } else {
        const d = await res.json();
        alert(d.error || 'Release call rejected');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter computation logic line rules arrays
  const filteredTrekkers = trekkers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.band_id.includes(searchQuery)
  );

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* LEFT SIDE PANEL MATRIX CONTROL CONTAINER LAYOUT */}
      <div style={sidebarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Trail Network Monitor
          </h2>
          <button 
            onClick={() => navigate('/admin/login')}
            style={{ padding: '6px 12px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🔒 Vault Control
          </button>
        </div>

        {/* ONBOARD REGISTRATION SECTION SUB-FORM */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
            Initialize Trekker Wristband Node
          </h3>
          <form onSubmit={handleRegister}>
            <input 
              type="text" placeholder="Trekker Full Name" style={inputStyle}
              value={formData.name} onChange={e => handleInputChange('name', e.target.value)}
            />
            <input 
              type="text" placeholder="13-Digit Electronic Band ID" style={inputStyle}
              value={formData.reg_id} onChange={e => handleInputChange('reg_id', e.target.value)}
            />
            <input 
              type="text" placeholder="Emergency Relative Phone Contact" style={inputStyle}
              value={formData.emergency_contact} onChange={e => handleInputChange('emergency_contact', e.target.value)}
            />

            {/* 🔄 DYNAMIC DROPDOWN MODIFICATION FOR REGISTERED DATABASE SHOPS */}
            <select 
              style={{ ...inputStyle, cursor: 'pointer', height: '40px', WebkitAppearance: 'menulist' }}
              value={formData.shop_id} 
              onChange={e => handleInputChange('shop_id', e.target.value)}
            >
              {registeredShops.length === 0 ? (
                <option value="">Querying hub station arrays...</option>
              ) : (
                registeredShops.map(shop => (
                  <option key={shop.shop_id} value={shop.shop_id}>
                    {shop.shop_name} ({shop.shop_id})
                  </option>
                ))
              )}
            </select>

            {error && <p style={{ color: '#dc2626', fontSize: '12px', margin: '5px 0', fontWeight: '500' }}>⚠️ {error}</p>}
            {successMsg && <p style={{ color: '#16a34a', fontSize: '12px', margin: '5px 0', fontWeight: '500' }}>✅ {successMsg}</p>}

            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Configuring System Rings...' : '⚡ Onboard Signal Packet'}
            </button>
          </form>
        </div>

        {/* FILTER LIVE ROSTER SEARCH BLOCK ROW */}
        <div style={{ marginBottom: '12px' }}>
          <input 
            type="text" placeholder="🔍 Search live roster array names or node keys..." 
            style={{ ...inputStyle, marginBottom: '0px', backgroundColor: '#f8fafc' }}
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ACTIVE LIVE ROSTER SUB-SCROLL VIEW ELEMENT */}
        <h3 style={{ margin: '10px 0 8px 0', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>
          Live Tracking Array Roster ({filteredTrekkers.length})
        </h3>
        <div style={scrollContainerStyle}>
          {filteredTrekkers.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
              No tracking signals currently matches structural filters.
            </p>
          ) : (
            filteredTrekkers.map(t => (
              <div key={t.id} style={{ padding: '12px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: t.is_sos ? '#fef2f2' : t.is_lost ? '#fffbeb' : '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Band: <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{t.band_id}</code>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCheckout(t.band_id)}
                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Release
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', color: '#475569', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                  <div>💓 <strong>{t.hr || '--'}</strong> bpm</div>
                  <div>🔋 <strong>{t.batt ?? 100}%</strong></div>
                  <div style={{ marginLeft: 'auto', color: t.is_sos ? '#ef4444' : t.is_lost ? '#d97706' : '#16a34a', fontWeight: 'bold' }}>
                    {t.safety_status} {t.is_lost && `(${t.last_seen_mins}m ago)`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT SIDE GEOMETRIC RADAR MAP PANEL VISUALIZER */}
      <div style={{ flex: 1, height: '100vh', position: 'relative' }}>
        {mapConfig ? (
          <MapContainer 
            center={mapConfig.center} 
            zoom={14} 
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Core Geofence Safe Radius Ring Boundary mappings */}
            <Circle 
              center={[mapConfig.outer_border.lat, mapConfig.outer_border.lng]}
              radius={mapConfig.outer_border.radius * 1000}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.03, dashArray: '5, 10' }}
            />

            {/* Trail Waypoints Bounds Iteration Blocks */}
            {mapConfig.trail_zones.map((zone, idx) => (
              <LayerGroup key={idx}>
                <Circle 
                  center={[zone.lat, zone.lng]}
                  radius={zone.radius * 1000}
                  pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.05 }}
                />
                <Marker position={[zone.lat, zone.lng]} icon={greyIcon}>
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <strong style={{ cursor: 'pointer' }} title={`title: ${zone.name}`}>
                      Checkpoint: {zone.name}
                    </strong>
                    {showPopup && (
                      <div className="popup">
                        <div className="popup-content">
                          <h3>Checkpoint Details</h3>
                          <p>Name: {zone.name}</p>
                          <button onClick={() => setShowPopup(false)}>Close</button>
                        </div>
                      </div>
                    )}
                  </Tooltip>  
                </Marker>
                
              </LayerGroup>
            ))}

            {/* Live active dynamic trekker signals node coordinate updates */}
            {trekkers.map(t => {
              if (!t.current_pos) return null;
              const markerIcon = t.is_sos ? redIcon : blueIcon;
              
              return (
                <LayerGroup key={t.id}>
                  {/* Historical tracking breadcrumb trail lines rendering */}
                  {t.history && t.history.length > 1 && (
                    <Polyline 
                      positions={t.history.map(h => h.pos)}
                      pathOptions={{ color: t.is_sos ? '#ef4444' : '#3b82f6', weight: 3, opacity: 0.6, dashArray: '4, 6' }}
                    />
                  )}
                  
                  <CircleMarker 
                    center={t.current_pos}
                    radius={8}
                    pathOptions={{ color: t.is_sos ? '#ef4444' : '#3b82f6', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}
                  />

                  <Marker position={t.current_pos} icon={markerIcon}>
                    <Popup minWidth={180}>
                      <div style={{ fontFamily: 'sans-serif' }}>
                        <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>{t.name}</h4>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>Band Node Key: {t.band_id}</p>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                          <div>Telemetry Hub Station: <strong>{t.shop_name}</strong></div>
                          <div>Cardiac Rate Pulse: <strong>{t.hr} BPM</strong></div>
                          <div>Radio Battery Node: <strong>{t.batt}%</strong></div>
                          <div>Signal State Condition: <span style={{ color: t.is_sos ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>{t.safety_status}</span></div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </LayerGroup>
              );
            })}
          </MapContainer>
        ) : (
          <div style={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', color: '#64748b', fontFamily: 'sans-serif', fontSize: '15px' }}>
            <div>🔄 Synchronizing live geographic satellite configurations matrix loops...</div>
          </div>
        )}
      </div>
      
    </div>
  );
};

// --- CORE LAYOUT VIEWPORT INLINE STYLE SHEETS OVERFLOW ---
const sidebarStyle = {
  width: '360px',
  backgroundColor: '#ffffff',
  boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
  padding: '20px 20px 0px 20px', 
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  boxSizing: 'border-box',
  zIndex: 1000,
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, sans-serif'
};

const scrollContainerStyle = {
  flex: 1,
  minHeight: 0, 
  overflowY: 'auto', 
  display: 'flex', 
  flexDirection: 'column',
  paddingBottom: '20px' 
};

const inputStyle = { 
  width: '100%', padding: '11px 14px', 
  marginBottom: '10px', 
  boxSizing: 'border-box', 
  borderRadius: '6px', 
  border: '1px solid #cbd5e1', 
  fontSize: '14px',
  fontFamily: 'inherit',
  backgroundColor: '#ffffff',
  color: '#1e293b'
};

const btnStyle = { 
  width: '100%', 
  padding: '12px', 
  backgroundColor: '#0f172a', 
  color: '#ffffff', 
  border: 'none', 
  borderRadius: '6px', 
  fontSize: '14px', 
  fontWeight: '700', 
  cursor: 'pointer',
  transition: 'background-color 0.2s'
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainTracker />} />
        <Route path="/admin/login" element={<AdminLogin onLoginSuccess={() => window.location.href = '/admin/dashboard'} onCancel={() => window.location.href = '/'} />} />
        <Route path="/admin/dashboard" element={localStorage.getItem('admin_token') ? <AdminDashboard onLogout={() => { localStorage.clear(); window.location.href = '/'; }} /> : <Navigate to="/admin/login" />} />
      </Routes>
    </Router>
  );
};

export default App;