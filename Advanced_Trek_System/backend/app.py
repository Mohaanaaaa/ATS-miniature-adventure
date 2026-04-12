from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Trekker, Trip, Telemetry
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configuration for SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trek_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

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
@app.route('/api/ingest', methods=['POST'])
def ingest_data():
    data = request.json
    band_id = data.get('band_id')
    
    # Find the active trip for this 13-digit band ID
    active_trip = Trip.query.filter_by(band_id=band_id, is_active=True).first()

    if not active_trip:
        return jsonify({"error": "No active trip found for this band"}), 404

    hr = int(data.get('hr', 0))
    is_sos = data.get('sos', False)
    
    # --- BIOMETRIC VALIDATION LOGIC ---
    # We determine the "Health Status" based on the heart rate sensor
    status = "NORMAL"
    if hr == 0:
        status = "BAND_DETACHED"  # Movement detected but no pulse
    elif hr > 160:
        status = "CRITICAL_HR"    # Possible medical distress
    elif is_sos:
        status = "SOS_ACTIVE"

    new_log = Telemetry(
        trip_id=active_trip.id,
        lat=data['lat'],
        lng=data['lng'],
        heart_rate=hr,
        is_sos=is_sos
        # Note: You might need to add a 'status' column to your Telemetry model 
        # in models.py if you want to store this specific string.
    )
    
    db.session.add(new_log)
    db.session.commit()
    
    return jsonify({
        "status": "Data logged",
        "health_check": status
    }), 200

# 3. Get All Active Trekkers for Map
@app.route('/api/active_trekkers', methods=['GET'])
def get_active_trekkers():
    active_trips = Trip.query.filter_by(is_active=True).all()
    results = []
    for trip in active_trips:
        trekker = Trekker.query.get(trip.trekker_id)
        history = [[loc.lat, loc.lng] for loc in trip.locations]
        
        # Determine current status from the latest ping
        last_ping = trip.locations[-1] if trip.locations else None
        
        is_sos = False
        is_alive = True # Default
        
        if last_ping:
            is_sos = last_ping.is_sos
            if last_ping.heart_rate == 0:
                is_alive = False # Flag for "Band Lost/Detached"

        results.append({
            "id": trip.id,
            "name": trekker.name,
            "band_id": trip.band_id,
            "history": history,
            "current_pos": history[-1] if history else None,
            "hr": last_ping.heart_rate if last_ping else 0,
            "is_sos": is_sos,
            "is_alive": is_alive 
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