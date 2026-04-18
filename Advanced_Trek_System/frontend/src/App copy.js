import React, { useState, useEffect } from 'react';
import { 
  MapContainer, TileLayer, Marker, Popup, Polyline, 
  CircleMarker, Tooltip, Circle, LayerGroup 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// --- KUMARA HILLS COORDINATES ---
//const KUMARA_TRAIL = [
 // { name: "Kukke Entrance", lat: 12.6654, lng: 75.6601, radius: 0.5 },
  //{ name: "Bhattara Mane", lat: 12.6715, lng: 75.6820, radius: 0.8 },
  //{ name: "Sesha Parvatha", lat: 12.6620, lng: 75.7010, radius: 0.6 },
  //{ name: "KP Peak", lat: 12.6675, lng: 75.7125, radius: 0.5 }
//];

function App() {
  const [trekkers, setTrekkers] = useState([]);
  const [viewMode, setViewMode] = useState('realtime'); // 'realtime' or 'checkpoints'
  const [formData, setFormData] = useState({ name: '', reg_id: '', emergency_contact: '' });
  const [mapConfig, setMapConfig] = useState(null);

  // Center the map on Kukke Entrance
  const mapCenter = [12.6654, 75.6601];

  useEffect(() => {
    // Fetch the hidden map configuration
    fetch('http://127.0.0.1:5000/api/map_config')
      .then(res => res.json())
      .then(data => setMapConfig(data));
  }, []);


  // Fetch data from Flask every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://127.0.0.1:5000/api/active_trekkers')
        .then(res => res.json())
        .then(data => setTrekkers(data))
        .catch(err => console.error("Sync Error:", err));
    }, 5000);
    return () => clearInterval(interval);
  }, []);
    
  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await fetch('http://127.0.0.1:5000/api/start_trek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      alert("Trekker Registered & Band Activated!");
      setFormData({ name: '', reg_id: '', emergency_contact: '' });
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  };

  if (!mapConfig) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading Secure Map Configuration...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5' }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{ width: '380px', padding: '20px', borderRight: '1px solid #ddd', overflowY: 'auto', backgroundColor: '#fff' }}>
        <h2 style={{ color: '#007bff', marginBottom: '5px' }}>Trekker Command</h2>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>Kumara Hills Safety Monitor</p>
        
        <form onSubmit={handleRegister} style={{ marginBottom: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <h4 style={{ marginTop: 0 }}>Register New Trekker</h4>
          <input style={inputStyle} placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input style={inputStyle} placeholder="13-Digit Band ID" value={formData.reg_id} onChange={e => setFormData({...formData, reg_id: e.target.value})} required />
          <input style={inputStyle} placeholder="Emergency Contact" value={formData.emergency_contact} onChange={e => setFormData({...formData, emergency_contact: e.target.value})} required />
          <button type="submit" style={btnStyle}>Activate Band</button>
        </form>

        <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '20px 0' }} />

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px' }}>View Controls</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setViewMode('realtime')} style={{...toggleBtn, backgroundColor: viewMode === 'realtime' ? '#007bff' : '#6c757d'}}>Live Path</button>
            <button onClick={() => setViewMode('checkpoints')} style={{...toggleBtn, backgroundColor: viewMode === 'checkpoints' ? '#007bff' : '#6c757d'}}>15-Min Logs</button>
          </div>
        </div>

        <h4>Active Trekkers</h4>
        {trekkers.length === 0 && <p style={{ color: '#888', fontStyle: 'italic' }}>No trekkers currently on trail.</p>}
          {trekkers.map(t => (
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
              <strong>{t.name}</strong>
              <span style={{ fontSize: '11px', color: '#999' }}>{t.band_id}</span>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: t.is_sos ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
              {t.is_sos ? "🚨 SOS EMERGENCY" : `● Healthy - ${t.hr} BPM`}
            </p>
          </div>
        ))}
      </div>

      {/* --- LIVE MAP --- */}
      <div style={{ flex: 1 }}>
        <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Draw the Safe Chain Circles */}
          {/* 1. MASTER OUTER BORDER (From Backend) */}
          <Circle 
            center={[mapConfig.outer_border.lat, mapConfig.outer_border.lng]} 
            radius={mapConfig.outer_border.radius * 1000} 
            pathOptions={{ color: 'red', weight: 2, fillOpacity: 0.02, dashArray: '15, 15' }} 
          />
          {/* 2. TRAIL SAFE ZONES (From Backend) */}
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

          {/* TREKKER RENDERING */}
          {trekkers.map((t) => {
            //if (!t.history || t.history.length === 0 || !t.current_pos) return null;
            //const [lat, lng] = t.current_pos;
            //if (isNaN(lat) || isNaN(lng)) return null;
            if (!t.current_pos) return null;
            const historyPoints = viewMode === 'checkpoints' 
              ? t.history.filter((_, idx) => idx % 30 === 0) 
              : t.history;

            return (
              <LayerGroup key={t.id}>
                {/* 1. Trail Line */}
                <Polyline 
                  positions={t.history.map(h => h.pos)} 
                  pathOptions={{ color: t.is_sos ? '#dc3545' : '#007bff', weight: 4, opacity: 0.6 }} 
                />

                {/* 2. Interactive Historical Checkpoints */}
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
                        💓 Heart: {pointObj.hr} BPM
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}

                {/* 3. Current Live Marker */}
                <Marker position={t.current_pos} icon={t.is_sos ? redIcon : blueIcon}>
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '150px' }}>
                      <strong style={{ fontSize: '16px' }}>{t.name}</strong><br/>
                      <div style={{ 
                        margin: '10px 0', 
                        padding: '5px', 
                        borderRadius: '4px',
                        backgroundColor: t.is_sos ? '#ffebee' : '#e8f5e9',
                        color: t.is_sos ? '#c62828' : '#2e7d32',
                        fontWeight: 'bold'
                      }}>
                        {t.is_sos ? "OUT OF RANGE" : "SAFE ON TRAIL"}
                      </div>
                      <small>Pulse: {t.hr} BPM</small>
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
const inputStyle = { width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' };
const btnStyle = { width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };
const toggleBtn = { flex: 1, padding: '10px', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: '0.3s' };

export default App;