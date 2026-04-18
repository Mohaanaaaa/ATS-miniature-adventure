from sqlite3 import OperationalError

from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Trekker, Trip, Telemetry
from datetime import datetime, time, timedelta
import math


app = Flask(__name__)
CORS(app)

# Configuration for SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trek_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Define your Base Station Coordinates (e.g., your shop or camp)
# --- KUMARA PARVATHA TRAIL LOCK ---
# Coordinates for: Base, Bhattara Mane, Sesha Parvatha, and Peak
KUMARA_TRAIL = [
    {"name": "Kukke Entrance", "lat": 12.6654, "lng": 75.6601, "radius": 0.5}, 
    {"name": "Bhattara Mane", "lat": 12.6715, "lng": 75.6820, "radius": 0.8},
    {"name": "Sesha Parvatha", "lat": 12.6620, "lng": 75.7010, "radius": 0.6},
    {"name": "KP Peak", "lat": 12.6675, "lng": 75.7125, "radius": 0.5}
]
# The "Big Border" encompassing the whole area
MASTER_BORDER = {"lat": 12.6660, "lng": 75.6850, "radius": 4.5}

@app.route('/api/map_config', methods=['GET'])
def get_map_config():
    return jsonify({
        "trail_zones": KUMARA_TRAIL,
        "outer_border": MASTER_BORDER,
        "center": [12.6654, 75.6601]
    })

'''TREK_AREAS = [
    {
        "name": "Kumara Hills Base", 
        "lat": 12.6654, 
        "lng": 75.6601, 
        "radius": 5.0, # 5km radius around the base/trail
        "type": "MANDATORY_ZONE" 
    },
    {
        "name": "Rest Point 1", 
        "lat": 12.6720, 
        "lng": 75.6750, 
        "radius": 0.5, # Small safety circle around a camp
        "type": "SAFE_ZONE"
    }
]

BASE_LAT = 12.9716 
BASE_LNG = 77.5946
GEOFENCE_RADIUS_KM = 50.0'''

def calculate_distance(lat1, lon1, lat2, lon2):
    # Haversine formula to find distance in KM
    R = 6371.0 
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# 1. Start Trek / Register (The "Swap" start)
@app.route('/api/start_trek', methods=['POST'])
def start_trek():
    data = request.json
    try:
        # Check if band is already active elsewhere
        existing_trip = Trip.query.filter_by(band_id=data['reg_id'], is_active=True).first()
        if existing_trip:
            return jsonify({"error": "This Band ID is already assigned to another trekker"}), 400

        new_trekker = Trekker(
            name=data['name'],
            reg_id=data['reg_id'],
            emergency_contact=data['emergency_contact']
        )
        db.session.add(new_trekker)
        db.session.commit()

        new_trip = Trip(trekker_id=new_trekker.id, band_id=data['reg_id'])
        db.session.add(new_trip)
        db.session.commit()
        
        return jsonify({"message": "Trekker registered and band activated!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 2. THE INGEST ROUTE (The "Alive" Logic happens here)
'''@app.route('/api/ingest', methods=['POST'])
def ingest_data():
    data = request.json
    if not data:
        return jsonify({"error": "No data received"}), 400

    band_id = data.get('band_id')
    active_trip = Trip.query.filter_by(band_id=band_id, is_active=True).first()
    
    if not active_trip:
        return jsonify({"error": "No active trip found for this band"}), 404

    try:
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        hr = int(data.get('hr', 0))
        manual_sos = data.get('sos', False)

        # Geofence check
        distance_km = calculate_distance(BASE_LAT, BASE_LNG, lat, lng)
        geofence_violation = distance_km > GEOFENCE_RADIUS_KM

        # SOS is true if button pressed OR geofence breached
        effective_sos = manual_sos or geofence_violation

        new_log = Telemetry(
            trip_id=active_trip.id,
            lat=lat,
            lng=lng,
            heart_rate=hr,
            is_sos=effective_sos
        )
        
        db.session.add(new_log)
        db.session.commit()

        return jsonify({"status": "Success", "distance_km": round(distance_km, 2)}), 200

    except (ValueError, TypeError, KeyError) as e:
        return jsonify({"error": f"Invalid data format: {str(e)}"}), 400'''
        
# Updated Ingest Route with Trek Area Logic
@app.route('/api/ingest', methods=['POST'])
def ingest_data():
    data = request.json
    if not data: return jsonify({"error": "No data"}), 400
    battery = data.get('batt', 100) # Get battery % from hardware
    if not data:
        return jsonify({"error": "No data received"}), 400

    band_id = data.get('band_id')
    active_trip = Trip.query.filter_by(band_id=band_id, is_active=True).first()
    
    if not active_trip:
        return jsonify({"error": "No active trip found for this band"}), 404

    try:
        #  Extract and Define variables clearly
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        hr = int(data.get('hr', 0))  # This ensures 'hr' is defined even if missing
        #manual_sos = data.get('sos', False)
        
        # 1. Master Border Check (First Defense)
        master_dist = calculate_distance(MASTER_BORDER['lat'], MASTER_BORDER['lng'], lat, lng)
        outside_master = master_dist > MASTER_BORDER['radius']

        # 2. Multi-Zone / Kumara Hills Logic
        # Trail Zone Check (Second Defense)
        in_trail_zone = False
        for area in KUMARA_TRAIL:
            if calculate_distance(area['lat'], area['lng'], lat, lng) <= area['radius']:
                in_trail_zone = True
                break
        '''in_safe_zone = False
        for area in KUMARA_TRAIL:
            dist = calculate_distance(area['lat'], area['lng'], lat, lng)
            if dist <= area['radius']:
                in_safe_zone = True
                break'''
        
        # 3. Final SOS status
        #geofence_violation = not in_trail_zone
        #effective_sos = manual_sos or geofence_violation
        in_trail_zone = any(calculate_distance(z['lat'], z['lng'], lat, lng) <= z['radius'] for z in KUMARA_TRAIL)
        effective_sos = data.get('sos', False) or outside_master or (not in_trail_zone)
        
        # --- BUSY DATABASE HANDLING ---
        attempts = 0
        while attempts < 3:
            try:
                new_log = Telemetry(
                    trip_id=active_trip.id, lat=lat, lng=lng, 
                    heart_rate=hr, battery_level=battery, is_sos=effective_sos
                )
                db.session.add(new_log)
                db.session.commit()
                return jsonify({"status": "Success", "in_zone": in_trail_zone}), 200
            except OperationalError:
                db.session.rollback()
                time.sleep(0.1) # Wait 100ms
                attempts += 1
        return jsonify({"error": "Database busy"}), 503
   
    except Exception as e:
        # This catches errors and prevents the 500 server crash
        return jsonify({"error": str(e)}), 400
    
# 3. Get All Active Trekkers for Map
@app.route('/api/active_trekkers', methods=['GET'])
def get_active_trekkers():
    active_trips = Trip.query.filter_by(is_active=True).all()
    results = []
    
    now = datetime.utcnow()
    
    for trip in active_trips:
        trekker = Trekker.query.get(trip.trekker_id)
        
        # 1. Build a detailed history for the interactive dots
        detailed_history = []
        for loc in trip.locations:
            detailed_history.append({
                "pos": [loc.lat, loc.lng],
                "time": loc.timestamp.strftime("%I:%M %p"), # Example: 04:15 PM
                "hr": loc.heart_rate,
                "is_sos": loc.is_sos
            })
        
        # 2. Get the very latest status
        last_ping = trip.locations[-1] if trip.locations else None
        
        # Check for Lost Signal (e.g., more than 10 minutes)
        is_lost = False
        last_seen_mins = 0
        if last_ping:
            # timedelta calculation
            diff = now - last_ping.timestamp
            last_seen_mins = int(diff.total_seconds() / 60)
            if last_seen_mins > 10: # 10 minutes threshold
                is_lost = True
        
        
        # 3. Compile the response
        results.append({
            "id": trip.id,
            "name": trekker.name,
            "band_id": trip.band_id,
            "history": detailed_history,
            "current_pos": detailed_history[-1]["pos"] if detailed_history else None,
            "hr": last_ping.heart_rate if last_ping else 0,
            "is_sos": last_ping.is_sos if last_ping else False,
            "is_alive": (last_ping.heart_rate > 0) if last_ping else True,
            "is_lost": is_lost,
            #"last_seen_mins": int((now - last_ping.timestamp).total_seconds() / 60) if last_ping else None
            "last_seen_mins": last_seen_mins # NEW DATA
            
        })
        
    return jsonify(results)

# 4. End Trek (The "Swap" release)
@app.route('/api/end_trek', methods=['POST'])
def end_trek():
    data = request.json
    trip = Trip.query.filter_by(band_id=data['band_id'], is_active=True).first()
    if trip:
        trip.is_active = False
        db.session.commit()
        return jsonify({"message": "Band released and trip archived"}), 200
    return jsonify({"error": "Trip not found"}), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)