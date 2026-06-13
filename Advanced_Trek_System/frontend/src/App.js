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

// 🛡️ SECURITY SHIELD: Checks localStorage to persist session on refresh
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

// --- PUBLIC MAP VIEW (MAIN LAYOUT) ---
function PublicMapComponent() {
  const navigate = useNavigate();
  const [availableShops, setAvailableShops] = useState([]);
  const [trekkers, setTrekkers] = useState([]);
  const [viewMode, setViewMode] = useState('realtime'); // 'realtime' or 'checkpoints'
  
  const [formData, setFormData] = useState({
    name: '',
    reg_id: '',
    emergency_contact: '',
    shop_id: 'shop_01'
  });

  const [mapConfig, setMapConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const mapCenter = [12.6654, 75.6601];

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/shops/available')
      .then(res => res.json())
      .then(data => setAvailableShops(data.shops || []))
      .catch(err => console.error(err));

    fetch('http://127.0.0.1:5000/api/map_config')
      .then(res => res.json())
      .then(data => setMapConfig(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const fetchActiveTrekkers = () => {
      fetch('http://127.0.0.1:5000/api/active_trekkers')
        .then(res => res.json())
        .then(data => setTrekkers(data))
        .catch(err => console.error("Sync Error:", err));
    };

    fetchActiveTrekkers();
    const interval = setInterval(fetchActiveTrekkers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (formData.reg_id.length !== 13 || isNaN(formData.reg_id)) {
      setErrorMessage('❌ Band ID must be exactly 13 digits');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:5000/api/start_trek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(`✅ Trekker "${formData.name}" registered successfully with Band ID ${formData.reg_id}!`);
        setFormData({ name: '', reg_id: '', emergency_contact: '', shop_id: 'shop_01' });
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(`❌ ${data.error || 'Registration failed'}`);
      }
    } catch (err) {
      setErrorMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mapConfig) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'inherit' }}>
        <h2>🔄 Loading Secure Map Configuration...</h2>
        <p>Connecting to Trek System Database</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* SIDEBAR PANEL */}
      <div style={sidebarStyle}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#0f172a' }}>Trekker Command</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Kumara Hills Safety Monitor</p>
        </div>

        {successMessage && <div style={{ padding: '10px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>{successMessage}</div>}
        {errorMessage && <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>{errorMessage}</div>}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>📝 Register New Trekker</h4>
          
          <input 
            style={inputStyle} 
            placeholder="Full Name" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
            disabled={loading}
          />
          
          <input 
            style={inputStyle} 
            placeholder="13-Digit Band ID" 
            value={formData.reg_id} 
            onChange={e => setFormData({...formData, reg_id: e.target.value})} 
            maxLength="13"
            required 
            disabled={loading}
          />
          
          <input 
            style={inputStyle} 
            placeholder="Emergency Contact" 
            value={formData.emergency_contact} 
            onChange={e => setFormData({...formData, emergency_contact: e.target.value})} 
            required 
            disabled={loading}
          />

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Select Registration Base Station:</label>
            <select
              style={inputStyle}
              value={formData.shop_id}
              onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
              required
            >
              <option value="">-- Choose a Registered Base Camp --</option>
              {availableShops.map((shop) => (
                <option key={shop.shop_id} value={shop.shop_id}>
                  🏢 {shop.shop_name} ({shop.contact_person})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" style={btnStyle} disabled={loading}>
            {loading ? '⏳ Registering...' : '✅ Activate Band'}
          </button>
        </form>

        {/* MASTER VAULT TERMINAL */}
        <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#334155', fontSize: '14px' }}>マスターヴォールト Master Vault</h4>
          <button type="button" onClick={() => navigate('/admin/login')} style={vaultBtnStyle}>
            🔓 Enter Vault
          </button>
          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
            <em>Restricted Access : Only Authorized Personnel</em>
          </p>
        </div>

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

        {/* VIEW MODE SELECTION CONTROLS */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#334155', fontSize: '14px' }}>🎯 View Controls</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button"
              onClick={() => setViewMode('realtime')} 
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'realtime' ? '#1e293b' : '#fff', color: viewMode === 'realtime' ? '#fff' : '#1e293b' }}
            >
              📍 Live Path
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('checkpoints')} 
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'checkpoints' ? '#1e293b' : '#fff', color: viewMode === 'checkpoints' ? '#fff' : '#1e293b' }}
            >
              📊 15-Min Logs
            </button>
          </div>
        </div>

        <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>👥 Active Trekkers ({trekkers.length})</h4>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {trekkers.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No active trekkers</p>
          ) : (
            trekkers.map(t => (
              <div key={t.id} style={{ padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: t.is_sos ? '#fef2f2' : '#fff', borderColor: t.is_sos ? '#fca5a5' : '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#1e293b' }}>{t.name}</strong>
                  <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>{t.band_id}</span>
                </div>
                <p style={{ margin: '6px 0', fontSize: '13px', fontWeight: 'bold', color: t.is_sos ? '#dc2626' : '#16a34a' }}>
                  {t.is_sos ? "🚨 EMERGENCY" : `💓 Pulse: ${t.hr} BPM`}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                  <span>🔋 {t.batt || 100}%</span>
                  <span style={{ fontWeight: 'bold', color: (t.batt || 100) < 20 ? '#dc2626' : '#16a34a' }}>
                    {(t.batt || 100) < 20 ? 'LOW' : 'OK'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAP CONTROLLER CANVAS VIEW */}
      <div style={{ flex: 1, height: '100%' }}>
        <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Boundaries */}
          <Circle 
            center={[mapConfig.outer_border.lat, mapConfig.outer_border.lng]} 
            radius={mapConfig.outer_border.radius * 1000} 
            pathOptions={{ color: 'red', weight: 2, fillOpacity: 0.02, dashArray: '15, 15' }} 
          />
          {mapConfig.trail_zones.map((zone, idx) => (
            <Circle 
              key={idx}
              center={[zone.lat, zone.lng]} 
              radius={zone.radius * 1000} 
              pathOptions={{ color: 'green', weight: 1, fillOpacity: 0.1 }} 
            >
              <Tooltip direction="top">{zone.name}</Tooltip>
            </Circle>
          ))}

          {/* Trekkers Mapping Loop */}
          {trekkers.map((t) => {
            const isLost = t.is_lost;
            let markerIcon = blueIcon;
            if (t.is_sos) markerIcon = redIcon;
            if (isLost) markerIcon = greyIcon;
            if (!t.current_pos) return null;
            
            // 🔥 FIXED: Added safe fallback (t.history || []) to prevent the "Cannot read properties of undefined" filter crash
            const currentHistory = t.history || [];
            const historyPoints = viewMode === 'checkpoints' 
              ? currentHistory.filter((_, idx) => idx % 30 === 0) 
              : currentHistory;

            return (
              <LayerGroup key={t.id}>
                <Polyline 
                  positions={currentHistory.map(h => h.pos)} 
                  pathOptions={{ color: t.is_sos ? '#dc3545' : '#007bff', weight: 4, opacity: 0.6 }} 
                />

                {historyPoints.map((pointObj, idx) => (
                  <CircleMarker 
                    key={`${t.id}-pt-${idx}`} 
                    center={pointObj.pos} 
                    radius={5}
                    pathOptions={{ color: '#fff', fillColor: pointObj.is_sos ? '#dc3545' : '#007bff', fillOpacity: 1, weight: 2 }}
                  >
                    <Tooltip sticky>
                      <div style={{ fontSize: '12px', padding: '5px' }}>
                        <b style={{ color: '#007bff' }}>{t.name}</b><br/>
                        🕒 Time: {pointObj.time}<br/>
                        💓 Heart: {pointObj.hr} BPM<br/>
                        📍 <b>Lat:</b> {pointObj.pos[0]?.toFixed(5)}<br/>
                        📍 <b>Lng:</b> {pointObj.pos[1]?.toFixed(5)}<br/>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}

                <Marker position={t.current_pos} icon={markerIcon}>
                  <Popup>
                    <div style={{ width: '160px', fontFamily: 'inherit' }}>
                      <strong>{t.name}</strong><br/>
                      {isLost ? (
                        <span style={{ color: 'grey' }}>⚠️ SIGNAL LOST ({t.last_seen_mins}m ago)</span>
                      ) : (
                        <b style={{ color: 'green' }}>🟢 LIVE</b>
                      )}
                      <div style={{ 
                        margin: '10px 0', 
                        padding: '5px', 
                        borderRadius: '4px',
                        backgroundColor: t.is_sos ? '#ffebee' : '#e8f5e9',
                        color: t.is_sos ? '#c62828' : '#2e7d32',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>
                        {t.is_sos ? "OUT OF RANGE" : "SAFE ON TRAIL"}
                      </div>
                      <small>💓 Pulse: {t.hr} BPM</small>
                    </div>
                  </Popup>
                </Marker>
              </LayerGroup>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

// --- APP ROUTER HUB ---
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicMapComponent />} />
        <Route path="/admin/login" element={<AdminLogin onLoginSuccess={(token) => { localStorage.setItem('admin_token', token); window.location.href='/admin/dashboard'; }} onCancel={() => window.location.href='/'} />} />
        <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard onLogout={() => { localStorage.removeItem('admin_token'); window.location.href='/'; }} /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

// --- ORIGINAL SIDEBAR AND INPUT STYLES ---
const sidebarStyle = {
  width: '360px',
  backgroundColor: '#ffffff',
  boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  boxSizing: 'border-box',
  zIndex: 1000,
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, sans-serif'
};

const inputStyle = { 
  width: '100%', 
  padding: '11px 14px', 
  marginBottom: '14px', 
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
  backgroundColor: '#16a34a', 
  color: 'white', 
  border: 'none', 
  borderRadius: '6px', 
  fontWeight: '600', 
  fontSize: '14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
};

const vaultBtnStyle = {
  width: '100%',
  padding: '12px',
  background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '14px'
};

export default App;