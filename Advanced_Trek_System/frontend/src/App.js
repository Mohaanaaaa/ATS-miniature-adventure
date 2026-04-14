import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup,Tooltip } from 'react-leaflet';
import { getActiveTrekkers, startTrek } from './api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- CUSTOM MARKER ICONS ---
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function App() {
  const [trekkers, setTrekkers] = useState([]);
  const [form, setForm] = useState({ name: '', reg_id: '', emergency_contact: '' });

  // 1. Fetch live data every 10 seconds from Flask
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getActiveTrekkers();
        setTrekkers(res.data);
      } catch (err) {
        console.error("API Error:", err);
      }
    };
    
    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await startTrek(form);
      alert("Trekker Registered Successfully!");
      setForm({ name: '', reg_id: '', emergency_contact: '' });
    } catch (err) {
      alert("Registration failed. Check if Backend is running.");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{ width: '350px', padding: '20px', borderRight: '1px solid #ccc', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
        <h2 style={{ color: '#333' }}>Trekker Registration</h2>
        <form onSubmit={handleRegister} style={{ marginBottom: '30px' }}>
          <input 
            placeholder="Full Name" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
            required 
            style={{ width: '90%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
          <input 
            placeholder="13-Digit Band ID" 
            value={form.reg_id} 
            onChange={e => setForm({...form, reg_id: e.target.value})} 
            required 
            style={{ width: '90%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
          <input 
            placeholder="Emergency Contact No" 
            value={form.emergency_contact} 
            onChange={e => setForm({...form, emergency_contact: e.target.value})} 
            style={{ width: '90%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
          <button type="submit" style={{ width: '97%', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ACTIVATE BAND
          </button>
        </form>

        <hr />
        <h3>Live Trekker Feed</h3>
        {trekkers.length === 0 && <p style={{ color: '#888' }}>No trekkers currently active.</p>}
        {trekkers.map(t => (
          <div key={t.id} style={{
              padding: '15px', 
              marginBottom: '10px',
              borderRadius: '8px',
              backgroundColor: t.is_sos ? '#fff0f0' : '#fff',
              borderLeft: t.is_sos ? '6px solid #dc3545' : '6px solid #007bff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{t.name}</strong>
              <span style={{ fontSize: '12px', color: '#666' }}>{t.band_id}</span>
            </div>
            <p style={{ margin: '5px 0', fontSize: '14px', color: t.is_sos ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
              {t.is_sos ? "🚨 SOS EMERGENCY" : "● Status: Healthy"}
            </p>
          </div>
        ))}
      </div>

      {/* --- LIVE MAP --- */}
      <div style={{ flex: 1 }}>
        <MapContainer center={[12.9716, 77.5946]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {trekkers.map((t) => {
            // 1. SAFETY CHECK: If no history or current_pos exists yet, do not render anything for this person
            if (!t.history || t.history.length === 0 || !t.current_pos) {
              return null; 
            }

            // 2. DATA VALIDATION: Ensure the coordinates are valid numbers
            const [lat, lng] = t.current_pos;
            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
              return null;
            }

            return (
              <React.Fragment key={t.id}>
                {/* Main Marker */}
                <Marker position={[lat, lng]} icon={t.is_sos ? redIcon : blueIcon}>
                  <Popup>
                    <strong>{t.name}</strong><br/>
                    ID: {t.band_id}<br/>
                    Heart Rate: {t.hr} BPM
                  </Popup>
                </Marker>

                {/* Path Line - Only draw if there's more than one point */}
                {t.history.length > 1 && (
                  <Polyline 
                    positions={t.history.map(h => h.pos)} 
                    pathOptions={{ color: t.is_sos ? 'red' : 'blue', weight: 4 }} 
                  />
                )}

                {/* Historical Checkpoints */}
                {/* 3. Historical Checkpoints (The Dots) */}
                {t.history.map((pointObj, idx) => (
                  <CircleMarker 
                    key={`${t.id}-point-${idx}`}
                    center={pointObj.pos}
                    radius={5}
                    pathOptions={{ 
                      fillColor: pointObj.is_sos ? 'red' : '#007bff', 
                      color: 'white', 
                      weight: 1, 
                      fillOpacity: 0.8 
                    }}
                  >
                    {/* Use Tooltip for "Mouse Over" details */}
                    <Tooltip sticky direction="top" opacity={1}>
                      <div style={{ padding: '5px', fontSize: '12px' }}>
                        <strong style={{ color: '#007bff' }}>Checkpoint {idx + 1}</strong><br/>
                        🕒 <b>Time:</b> {pointObj.time}<br/>
                        💓 <b>Pulse:</b> {pointObj.hr} BPM<br/>
                        📍 <b>Lat:</b> {pointObj.pos[0].toFixed(5)}<br/>
                        📍 <b>Lng:</b> {pointObj.pos[1].toFixed(5)}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;