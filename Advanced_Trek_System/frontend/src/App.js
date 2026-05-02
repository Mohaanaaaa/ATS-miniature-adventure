import React, { useState, useEffect } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, Polyline, 
  CircleMarker, Tooltip, Circle, LayerGroup 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

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

function App() {
  // ========== ADMIN AUTHENTICATION STATE ==========
  const [adminToken, setAdminToken] = useState(localStorage.getItem('admin_token'));
  const [isMasterAdmin, setIsMasterAdmin] = useState(!!adminToken);
  const [showLoginPage, setShowLoginPage] = useState(false);

  // ========== TREKKER TRACKING STATE ==========
  const [trekkers, setTrekkers] = useState([]);
  const [viewMode, setViewMode] = useState('realtime');
  const [formData, setFormData] = useState({ 
    name: '', 
    reg_id: '', 
    emergency_contact: '', 
    shop_id: 'shop_01' 
  });
  const [shops, setShops] = useState([]);
  const [mapConfig, setMapConfig] = useState(null);
  const [currentShop, setCurrentShop] = useState('all');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const mapCenter = [12.6654, 75.6601];

  // ========== FILTER TREKKERS BY SHOP ==========
  const filteredTrekkers = trekkers.filter(t => 
    currentShop === 'all' || t.shop_id === currentShop
  );

  // ========== FETCH AVAILABLE SHOPS ==========
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/shops/dropdown/options');
        const data = await response.json();
        if (data.shops && data.shops.length > 0) {
          setShops(data.shops);
        } else {
          // Fallback to default shops
          setShops([
            { value: 'shop_01', label: '🏕️ Shop 01 (Default)' },
            { value: 'shop_02', label: '🏕️ Shop 02' },
            { value: 'shop_03', label: '🏕️ Shop 03' },
            { value: 'shop_04', label: '🏕️ Shop 04' }
          ]);
        }
      } catch (err) {
        console.error('Error fetching shops:', err);
        // Use default options on error
        setShops([
          { value: 'shop_01', label: '🏕️ Shop 01 (Default)' }
        ]);
      }
    };
    
    fetchShops();
  }, []);

  // ========== HANDLE ADMIN LOGIN ==========
  const handleAdminLogin = (token) => {
    setAdminToken(token);
    setIsMasterAdmin(true);
    setShowLoginPage(false);
    localStorage.setItem('admin_token', token);
  };

  // ========== HANDLE ADMIN LOGOUT ==========
  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    setIsMasterAdmin(false);
    setShowLoginPage(false);
  };

  // ========== HANDLE ENTER VAULT ==========
  const handleEnterVault = () => {
    if (isMasterAdmin) {
      setShowLoginPage(false);
    } else {
      setShowLoginPage(true);
    }
  };

  // ========== FETCH MAP CONFIG ==========
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/map_config')
      .then(res => res.json())
      .then(data => setMapConfig(data))
      .catch(err => console.error('Error loading map config:', err));
  }, []);

  // ========== FETCH ACTIVE TREKKERS ==========
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://127.0.0.1:5000/api/active_trekkers')
        .then(res => res.json())
        .then(data => setTrekkers(data))
        .catch(err => console.error("Sync Error:", err));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ========== HANDLE TREKKER REGISTRATION ==========
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    // Validate Band ID is 13 digits
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
        setSuccessMessage(`✅ Trekker "${formData.name}" registered with Band ID ${formData.reg_id}!`);
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

  // ========== CONDITIONAL RENDERING ==========
  if (isMasterAdmin && !showLoginPage) {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  if (showLoginPage) {
    return <AdminLogin onLoginSuccess={handleAdminLogin} onCancel={() => setShowLoginPage(false)} />;
  }

  if (!mapConfig) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f0f2f5',
        flexDirection: 'column'
      }}>
        <h2>🔄 Loading Secure Map Configuration...</h2>
        <p>Connecting to Trek System Database</p>
      </div>
    );
  }

  // ========== MAIN UI ==========
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5' }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{ 
        width: '380px', 
        padding: '20px', 
        borderRight: '1px solid #ddd', 
        overflowY: 'auto', 
        backgroundColor: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#007bff', marginBottom: '5px' }}>Trekker Command</h2>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '0' }}>Kumara Hills Safety Monitor</p>
        </div>

        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div style={{
            padding: '10px',
            marginBottom: '15px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            color: '#155724',
            borderRadius: '5px',
            fontSize: '12px'
          }}>
            {successMessage}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <div style={{
            padding: '10px',
            marginBottom: '15px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            borderRadius: '5px',
            fontSize: '12px'
          }}>
            {errorMessage}
          </div>
        )}
       
        <form onSubmit={handleRegister} style={{ 
          marginBottom: '30px', 
          padding: '15px', 
          background: '#f8f9fa', 
          borderRadius: '8px', 
          border: '1px solid #e9ecef' 
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '15px' }}>📝 Register New Trekker</h4>
          
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
          
          {/* SHOP DROPDOWN */}
          <select 
            style={{...inputStyle, marginBottom: '12px'}}
            value={formData.shop_id}
            onChange={e => setFormData({...formData, shop_id: e.target.value})}
            disabled={loading || shops.length === 0}
          >
            <option value="">-- Select Shop --</option>
            {shops.length > 0 ? (
              shops.map(shop => (
                <option key={shop.value} value={shop.value}>
                  {shop.label}
                </option>
              ))
            ) : (
              <option value="shop_01">🏕️ Shop 01 (Default)</option>
            )}
          </select>

          <button 
            type="submit" 
            style={{...btnStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer'}}
            disabled={loading}
          >
            {loading ? '⏳ Registering...' : '✅ Activate Band'}
          </button>
        </form>

        {/* ========== VAULT ACCESS SECTION ========== */}
        <div style={{
          backgroundColor: '#1c1f24',
          padding: '15px',
          borderRadius: '8px',
          border: '2px solid #00ff41',
          marginBottom: '20px',
          boxShadow: '0 0 10px rgba(0, 255, 65, 0.2)'
        }}>
          <h4 style={{ marginTop: 0, fontSize: '13px', marginBottom: '10px', color: '#00ff41' }}>
            🔐 Master Admin Access
          </h4>
          <button 
            onClick={handleEnterVault}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#1c1f24',
              color: '#00ff41',
              border: '1px solid #00ff41',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#00ff41';
              e.target.style.color = '#1c1f24';
              e.target.style.boxShadow = '0 0 15px rgba(0, 255, 65, 0.5)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#1c1f24';
              e.target.style.color = '#00ff41';
              e.target.style.boxShadow = 'none';
            }}
          >
            {isMasterAdmin ? '🔓 Dashboard' : '🔓 Enter Vault'}
          </button>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '10px', marginBottom: 0 }}>
            <em>admin / kp-vault-2026</em>
          </p>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '20px 0' }} />

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px' }}>🎯 View Controls</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setViewMode('realtime')} 
              style={{...toggleBtn, backgroundColor: viewMode === 'realtime' ? '#007bff' : '#6c757d'}}
            >
              📍 Live Path
            </button>
            <button 
              onClick={() => setViewMode('checkpoints')} 
              style={{...toggleBtn, backgroundColor: viewMode === 'checkpoints' ? '#007bff' : '#6c757d'}}
            >
              📊 15-Min Logs
            </button>
          </div>
        </div>
        
        <h4>👥 Active Trekkers ({filteredTrekkers.length})</h4>
        {filteredTrekkers.length === 0 ? (
          <p style={{ color: '#999', fontSize: '13px' }}>No active trekkers</p>
        ) : (
          filteredTrekkers.map(t => (
            <div key={t.id} style={{
              padding: '15px', 
              marginBottom: '12px',
              borderRadius: '8px',
              backgroundColor: t.is_sos ? '#fff5f5' : '#fff',
              borderLeft: t.is_sos ? '6px solid #dc3545' : '6px solid #28a745',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              border: '1px solid #eee'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '15px' }}>{t.name}</strong>
                <span style={{ fontSize: '11px', color: '#666', backgroundColor: '#f0f0f0', padding: '3px 8px', borderRadius: '3px' }}>
                  {t.band_id}
                </span>
              </div>
              <p style={{ margin: '10px 0 8px 0', fontSize: '13px', color: t.is_sos ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
                {t.is_sos ? "🚨 EMERGENCY" : `💓 Pulse: ${t.hr} BPM`}
              </p>    
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>🔋 {t.battery || 100}%</span>
                <span style={{ color: (t.battery || 100) < 20 ? 'red' : 'green', fontWeight: 'bold' }}>
                  {(t.battery || 100) < 20 ? 'LOW' : 'OK'}
                </span>
              </div>      
            </div>
          ))
        )}
      </div>

      {/* --- LIVE MAP --- */}
      <div style={{ flex: 1 }}>
        <MapContainer center={mapCenter} zoom={10} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Safe Zones */}
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

          {/* TREKKERS */}
          {filteredTrekkers.map((t) => {
            const isLost = t.is_lost;
            let markerIcon = blueIcon;
            if (t.is_sos) markerIcon = redIcon;
            if (isLost) markerIcon = greyIcon;
            if (!t.current_pos) return null;
            
            const historyPoints = viewMode === 'checkpoints' 
              ? t.history.filter((_, idx) => idx % 30 === 0) 
              : t.history;

            return (
              <LayerGroup key={t.id}>
                <Polyline 
                  positions={t.history.map(h => h.pos)} 
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
                        📍 <b>Lat:</b> {pointObj.pos[0].toFixed(5)}<br/>
                        📍 <b>Lng:</b> {pointObj.pos[1].toFixed(5)}<br/>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}

                <Marker position={t.current_pos} icon={markerIcon}>
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '150px' }}>
                      <strong style={{ fontSize: '13px' }}>{t.name}</strong><br/>
                      {isLost ? (
                        <span style={{color: 'grey'}}>⚠️ SIGNAL LOST ({t.last_seen_mins}m ago)</span>
                      ) : (
                        <b style={{color: 'green'}}>🟢 LIVE</b>
                      )}
                      <div style={{ 
                        margin: '10px 0', 
                        padding: '5px', 
                        borderRadius: '4px',
                        backgroundColor: t.is_sos ? '#ffebee' : '#e8f5e9',
                        color: t.is_sos ? '#c62828' : '#2e7d32',
                        fontWeight: 'bold',
                        fontSize: '12px'
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

// --- CSS-in-JS STYLES ---
const inputStyle = { 
  width: '100%', 
  padding: '10px', 
  marginBottom: '12px', 
  boxSizing: 'border-box', 
  borderRadius: '5px', 
  border: '1px solid #ddd', 
  fontSize: '14px',
  fontFamily: 'inherit'
};

const btnStyle = { 
  width: '100%', 
  padding: '12px', 
  backgroundColor: '#28a745', 
  color: 'white', 
  border: 'none', 
  borderRadius: '5px', 
  cursor: 'pointer', 
  fontWeight: 'bold', 
  fontSize: '14px',
  transition: 'all 0.3s ease'
};

const toggleBtn = { 
  flex: 1, 
  padding: '10px', 
  color: 'white', 
  border: 'none', 
  borderRadius: '5px', 
  cursor: 'pointer', 
  fontSize: '13px', 
  fontWeight: '600', 
  transition: '0.3s' 
};

export default App;