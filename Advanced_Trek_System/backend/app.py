from ast import Load
from sqlite3 import OperationalError
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import Shop, db, Trekker, Trip, Telemetry
import math
from datetime import datetime, timezone
from functools import wraps
import os
import jwt
from dotenv import load_dotenv
import bleach
import re
import json
import logging
from logging.handlers import RotatingFileHandler

# ============================================================================
# ⚙️ CONFIGURATIONS & ENVIRONMENT LOAD MANAGEMENT
# ============================================================================
load_dotenv()
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'SuperSecretRandomSecureString_ChangeMe2026!')
ENV = os.getenv('FLASK_ENV', 'development')

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trek_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

if ENV == 'production':
    ALLOWED_ORIGINS = [
        "https://yoursecuredomain.com",        
        "https://admin.yoursecuredomain.com"  
    ]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ]

# 🔓 CORS CONFIGURATION MATRIX
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

db.init_app(app)

ADMIN_CREDENTIALS = {
    "admin": "kp-vault-2026"  
}

# ============================================================================
# 📝 SECURE SYSTEM LOGGING OPERATIONS MATRIX
# ============================================================================
log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - [Route: %(filename)s] - %(message)s')
log_file_handler = RotatingFileHandler('trail_system.log', maxBytes=5242880, backupCount=3)
log_file_handler.setFormatter(log_formatter)
log_file_handler.setLevel(logging.ERROR) 

app.logger.addHandler(log_file_handler)
app.logger.setLevel(logging.ERROR)

# ============================================================================
# 🔒 ADMINISTRATIVE SECURITY MIDDLEWARE LAYER
# ============================================================================
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
            
        auth_header = request.headers.get('Authorization')
        token = None

        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
            elif len(parts) == 1:
                token = parts[0]
            else:
                return jsonify({"error": "Malformed authorization token string structure"}), 401

        if not token:
            return jsonify({"error": "Access Denied: Missing cryptographic validation token"}), 401

        try:
            decoded_payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.admin_user = decoded_payload.get('sub')
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Access Denied: Authentication token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Access Denied: Token validation failed or signature altered"}), 401

        return f(*args, **kwargs)
    return decorated

@app.before_request
def handle_options_and_origin_validation():
    if request.method == 'OPTIONS':
        response = jsonify({"status": "preflight cleared"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        return response, 200

@app.teardown_request
def shutdown_session(exception=None):
    db.session.remove()

# ============================================================================
# 🗺️ GEOGRAPHIC BOUNDARY PATTERNS (Kumara Parvatha Fences)
# ============================================================================
KUMARA_TRAIL = [
    {"name": "Kukke Entrance", "lat": 12.6654, "lng": 75.6601, "radius": 0.5}, 
    {"name": "Bhattara Mane", "lat": 12.6715, "lng": 75.6820, "radius": 0.8},
    {"name": "Sesha Parvatha", "lat": 12.6620, "lng": 75.7010, "radius": 0.6},
    {"name": "KP Peak", "lat": 12.6675, "lng": 75.7125, "radius": 0.5}
]
MASTER_BORDER = {"lat": 12.6660, "lng": 75.6850, "radius": 4.5}

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# ============================================================================
# 🟢 PUBLIC CLIENT CONTEXT MODULES
# ============================================================================
@app.route('/api/map_config', methods=['GET'])
def get_map_config():
    return jsonify({
        "trail_zones": KUMARA_TRAIL,
        "outer_border": MASTER_BORDER,
        "center": [12.6654, 75.6601]
    })
    
# 🌟 ADD THIS NEW PUBLIC ROUTE HERE FOR THE TREKKER REGISTRATION DROPDOWN
@app.route('/api/shops', methods=['GET', 'OPTIONS'])
def get_public_shops_list():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
    try:
        db_shops = Shop.query.all()
        serialized_shops = [
            {
                "shop_id": s.shop_id, 
                "shop_name": s.shop_name, 
                "contact_person": s.contact_person, 
                "max_trekkers": s.max_trekkers
            } for s in db_shops
        ]
        return jsonify(serialized_shops), 200
    except Exception as e:
        return jsonify([]), 200

@app.route('/api/start_trek', methods=['POST', 'OPTIONS'])
def start_trekker_trip():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
        
    data = request.get_json() or {}
    raw_name = data.get('name', '').strip()
    raw_reg_id = data.get('reg_id', '').strip()  
    raw_emergency_contact = data.get('emergency_contact', '').strip()
    shop_id = data.get('shop_id', 'shop_01').strip()

    if not raw_name or not raw_reg_id or not raw_emergency_contact:
        return jsonify({"error": "Bad Request: Missing required structural parameters."}), 400

    clean_name = bleach.clean(raw_name, tags=[], strip=True)
    clean_emergency = bleach.clean(raw_emergency_contact, tags=[], strip=True)

    if not re.match(r'^\d{13}$', raw_reg_id):
        return jsonify({"error": "Validation Failure: Band ID must consist of exactly 13 numeric digits."}), 400

    try:
        existing_active_trip = Trip.query.filter_by(band_id=raw_reg_id, is_active=True).first()
        if existing_active_trip:
            return jsonify({"error": f"Security Alert: Tracking Band {raw_reg_id} is already live!"}), 409

        new_trekker = Trekker(name=clean_name, reg_id=raw_reg_id, emergency_contact=clean_emergency)
        db.session.add(new_trekker)
        db.session.flush()

        new_trip = Trip(trekker_id=new_trekker.id, band_id=raw_reg_id, shop_id=shop_id, is_active=True)
        db.session.add(new_trip)
        db.session.commit()

        return jsonify({
            "message": "Trekker successfully initialized!",
            "trekker_id": new_trekker.id,
            "trip_id": new_trip.id
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database write failure: {str(e)}"}), 500

@app.route('/api/ingest', methods=['POST'])
def ingest_data():
    data = request.json or {}
    band_id = data.get('band_id')
    active_trip = Trip.query.filter_by(band_id=band_id, is_active=True).first()
    if not active_trip:
        return jsonify({"error": f"Band {band_id} not active"}), 404

    try:
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        hr = int(data.get('hr', 0))
        batt = data.get('batt', 100)
        manual_sos = data.get('sos', False)
        
        master_dist = calculate_distance(MASTER_BORDER['lat'], MASTER_BORDER['lng'], lat, lng)
        in_trail_zone = any(calculate_distance(z['lat'], z['lng'], lat, lng) <= z['radius'] for z in KUMARA_TRAIL)
        effective_sos = manual_sos or (master_dist > MASTER_BORDER['radius']) or (not in_trail_zone)
        
        new_log = Telemetry(
            trip_id=active_trip.id, lat=lat, lng=lng, heart_rate=hr,
            battery_level=batt, is_sos=effective_sos, timestamp=datetime.now(timezone.utc)
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"status": "Success", "in_zone": in_trail_zone, "sos": effective_sos}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500    

@app.route('/api/active_trekkers', methods=['GET'])
def get_active_trekkers():
    try:
        active_trips = Trip.query.filter_by(is_active=True).all()
        results = []
        now = datetime.now(timezone.utc)
        for trip in active_trips:
            trekker = db.session.get(Trekker, trip.trekker_id)
            detailed_history = []
            for loc in trip.locations:
                detailed_history.append({"pos": [loc.lat, loc.lng], "time": loc.timestamp.strftime("%I:%M %p"), "hr": loc.heart_rate, "is_sos": loc.is_sos})
            
            last_ping = trip.locations[-1] if trip.locations else None
            is_lost = False
            last_seen_mins = 0
            if last_ping:
                ping_time = last_ping.timestamp.replace(tzinfo=timezone.utc) if last_ping.timestamp.tzinfo is None else last_ping.timestamp
                diff = now - ping_time
                last_seen_mins = int(diff.total_seconds() / 60)
                is_lost = last_seen_mins > 10 

            hr = last_ping.heart_rate if last_ping else 0
            batt = getattr(last_ping, 'battery_level', 100) if last_ping else 100
            safety_status = "EMERGENCY" if (last_ping and last_ping.is_sos) else "ACTIVE"

            results.append({
                "id": trip.id, "name": trekker.name if trekker else f"Hardware Node #{trip.band_id}", "band_id": trip.band_id,
                "history": detailed_history, "current_pos": detailed_history[-1]["pos"] if detailed_history else None,
                "hr": hr, "batt": batt, "is_sos": last_ping.is_sos if last_ping else False, "is_lost": is_lost,
                "last_seen_mins": last_seen_mins, "safety_status": safety_status
            })
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/end_trek', methods=['POST'])
def end_trek():
    data = request.json
    trip = Trip.query.filter_by(band_id=data['band_id'], is_active=True).first()
    if trip:
        trip.is_active = False
        db.session.commit()
        return jsonify({"message": "Band released and trip archived"}), 200
    return jsonify({"error": "Trip not found"}), 404

# ============================================================================
# 🔒 ADMINISTRATIVE CHANNELS & STATS
# ============================================================================
@app.route('/api/admin/login', methods=['POST', 'OPTIONS'])
def admin_login():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    if username in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[username] == password:
        import datetime as dt
        payload = {
            'exp': dt.datetime.utcnow() + dt.timedelta(hours=2),
            'iat': dt.datetime.utcnow(),
            'sub': username
        }
        encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        return jsonify({
            "success": True,
            "token": encoded_jwt,
            "message": "Master Admin Access Granted",
            "access_level": "MASTER"
        }), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/admin/stats', methods=['GET', 'OPTIONS'])
@admin_required
def get_synchronized_stats():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
    try:
        return jsonify({
            "total_shops": Shop.query.count(),          
            "total_active_trekkers": Trip.query.filter_by(is_active=True).count(),
            "emergency_alerts": Telemetry.query.filter_by(is_sos=True).count(),
            "lost_signals": 0
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/trekkers', methods=['GET', 'OPTIONS'])
@admin_required
def get_admin_trekkers_by_status():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
    status_filter = request.args.get('status', 'ACTIVE')
    try:
        active_trips = Trip.query.filter_by(is_active=True).all()
        results = []
        now = datetime.now(timezone.utc)
        for trip in active_trips:
            trekker = db.session.get(Trekker, trip.trekker_id)
            if not trekker: continue
            last_ping = trip.locations[-1] if trip.locations else None
            current_status = "ACTIVE"
            if last_ping:
                ping_time = last_ping.timestamp.replace(tzinfo=timezone.utc) if last_ping.timestamp.tzinfo is None else last_ping.timestamp
                diff = now - ping_time
                if last_ping.is_sos: current_status = "EMERGENCY"
                elif (diff.total_seconds() / 60 > 10): current_status = "LOST_SIGNAL"
            if status_filter == "ACTIVE" or current_status == status_filter:
                results.append({
                    "id": trip.id, "name": trekker.name, "band_id": trip.band_id, 
                    "shop_name": trip.shop_id, "emergency_contact": trekker.emergency_contact, "status": current_status
                })
        return jsonify(results), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops', methods=['GET', 'POST', 'OPTIONS'])
@admin_required
def handle_shops_management():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
        
    if request.method == 'POST':
        data = request.json or {}
        shop_id = data.get('shop_id')
        if not shop_id:
            return jsonify({"error": "Missing unique station ID key."}), 400

        existing = Shop.query.filter_by(shop_id=shop_id).first()
        if existing:
            return jsonify({"error": f"Station ID '{shop_id}' already initialized."}), 400

        try:
            new_shop = Shop(
                shop_id=shop_id, shop_name=data.get('shop_name', 'New Operational Hub'),
                shop_location={"lat": 12.6654, "lng": 75.6601}, contact_person=data.get('contact_person', 'Ranger Head'),
                contact_phone=data.get('contact_phone', 'N/A'), max_trekkers=int(data.get('max_trekkers', 50))
            )
            db.session.add(new_shop)
            db.session.commit()
            return jsonify({"success": True, "message": f"Hub {shop_id} saved."}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

    try:
        db_shops = Shop.query.all()
        serialized_shops = [{"shop_id": s.shop_id, "shop_name": s.shop_name, "contact_person": s.contact_person, "contact_phone": s.contact_phone, "max_trekkers": s.max_trekkers} for s in db_shops]
        return jsonify({"shops": serialized_shops}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops/<shop_id>/trekkers', methods=['GET', 'OPTIONS'])
@admin_required
def get_trekkers_by_specific_shop(shop_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
    try:
        active_trips = Trip.query.filter_by(shop_id=shop_id, is_active=True).all()
        results = []
        now = datetime.now(timezone.utc)
        for trip in active_trips:
            trekker = db.session.get(Trekker, trip.trekker_id)
            if not trekker: continue
            last_ping = trip.locations[-1] if trip.locations else None
            current_status = "ACTIVE"
            if last_ping:
                ping_time = last_ping.timestamp.replace(tzinfo=timezone.utc) if last_ping.timestamp.tzinfo is None else last_ping.timestamp
                diff = now - ping_time
                if last_ping.is_sos: current_status = "EMERGENCY"
                elif (diff.total_seconds() / 60 > 10): current_status = "LOST_SIGNAL"
            results.append({
                "id": trip.id, "name": trekker.name, "band_id": trip.band_id,
                "shop_name": trip.shop_id, "emergency_contact": trekker.emergency_contact, "status": current_status
            })
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops/<shop_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
@admin_required
def handle_single_shop_modification(shop_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
        
    shop = Shop.query.filter_by(shop_id=shop_id).first()
    if not shop:
        return jsonify({"error": "Station row not found"}), 404
        
    if request.method == 'DELETE':
        try:
            db.session.delete(shop)
            db.session.commit()
            return jsonify({"success": True, "message": "Hub entry deleted cleanly."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
            
    if request.method == 'PUT':
        data = request.json or {}
        try:
            shop.shop_name = data.get('shop_name', shop.shop_name)
            shop.contact_person = data.get('contact_person', shop.contact_person)
            shop.contact_phone = data.get('contact_phone', shop.contact_phone)
            shop.max_trekkers = int(data.get('max_trekkers', shop.max_trekkers))
            db.session.commit()
            return jsonify({"success": True, "message": "Hub entry adjusted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route('/api/admin/next-shop-id', methods=['GET', 'OPTIONS'])
@app.route('/api/admin/shops/next-id', methods=['GET', 'OPTIONS'])
@admin_required
def get_next_shop_id_string():
    if request.method == 'OPTIONS':
        return jsonify({"status": "preflight cleared"}), 200
    try:
        total_shops = Shop.query.count()
        next_id = f"shop_{str(total_shops + 1).zfill(2)}"
        return jsonify({"next_shop_id": next_id}), 200
    except Exception as e:
        return jsonify({"next_shop_id": "shop_01"}), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)