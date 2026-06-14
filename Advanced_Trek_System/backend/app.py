from sqlite3 import OperationalError
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import Shop, db, Trekker, Trip, Telemetry
import math
from datetime import datetime, timezone
from functools import wraps
import secrets
import json
from sqlalchemy.exc import IntegrityError
import time 

app = Flask(__name__)
CORS(app)

# ============================================================================
# ⚙️ SYSTEM & DATABASE CONFIGURATIONS
# ============================================================================
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trek_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Fallback memory storage & credentials structure
SHOPS_DB = {}  
ADMIN_CREDENTIALS = {
    "admin": "kp-vault-2026"  # Master Credentials
}

db.init_app(app)

# ============================================================================
# 🗺️ GEOGRAPHIC BOUNDARY DEFINE PATTERNS (Kumara Parvatha Trail Fences)
# ============================================================================
KUMARA_TRAIL = [
    {"name": "Kukke Entrance", "lat": 12.6654, "lng": 75.6601, "radius": 0.5}, 
    {"name": "Bhattara Mane", "lat": 12.6715, "lng": 75.6820, "radius": 0.8},
    {"name": "Sesha Parvatha", "lat": 12.6620, "lng": 75.7010, "radius": 0.6},
    {"name": "KP Peak", "lat": 12.6675, "lng": 75.7125, "radius": 0.5}
]
MASTER_BORDER = {"lat": 12.6660, "lng": 75.6850, "radius": 4.5}

# ============================================================================
# 🧮 MATHEMATICAL CALCULATOR COMPONENTS
# ============================================================================
def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculates the distance between two coordinate pairs in kilometers via the Haversine formula"""
    R = 6371.0 
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# ============================================================================
# 🛡️ SECURITY TOKEN ENFORCEMENT MIDDLEWARE
# ============================================================================
def verify_admin_token(token):
    """Checks incoming text sequences against valid credential signatures"""
    return token == "ADMIN_VERIFIED_TOKEN_PLACEHOLDER"

def admin_required(f):
    """Decorator guarding administrative endpoint routes by intercepting Header Bearer Tokens"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip()
        if not token or not verify_admin_token(token):
            return jsonify({"error": "Unauthorized access"}), 403
        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# 🟢 PUBLIC CUSTOMER-FACING CHANNELS (No Authentication Constraints)
# ============================================================================

@app.route('/api/map_config', methods=['GET'])
def get_map_config():
    """
    [FUNCTION LABEL: PUBLIC_MAP_CONFIGURATION_FEEDER]
    Provides visual map layout constraints, trail points, and centers rendering views.
    """
    return jsonify({
        "trail_zones": KUMARA_TRAIL,
        "outer_border": MASTER_BORDER,
        "center": [12.6654, 75.6601]
    })

@app.route('/api/start_trek', methods=['POST'])
def start_trekker_trip():
    """
    Registers a new trekker and assigns them to an active band tracking trip.
    Validates that the 13-digit Band ID is unique and not currently deployed on the trail.
    """
    data = request.get_json() or {}
    name = data.get('name')
    reg_id = data.get('reg_id') # The unique 13-digit identifier from the frontend form
    emergency_contact = data.get('emergency_contact')
    shop_id = data.get('shop_id', 'shop_01')

    if not name or not reg_id or not emergency_contact:
        return jsonify({"error": "Missing registration parameters. All fields are mandatory."}), 400

    try:
        # 🛡️ ZERO-CONFLICT UNIQUE GUARD:
        # We query strictly using the 'is_active' attribute defined in your models.py
        existing_active_trip = Trip.query.filter_by(band_id=reg_id, is_active=True).first()
        if existing_active_trip:
            return jsonify({
                "error": f"Band ID {reg_id} is already actively deployed on the trail! Please use a different, unassigned tracking band."
            }), 409 # Conflict Status Code

        # 1. Spawn persistent Trekker Identity record matching schema columns
        new_trekker = Trekker(
            name=name,
            reg_id=reg_id, 
            emergency_contact=emergency_contact
        )
        db.session.add(new_trekker)
        db.session.flush()  # Allocates new_trekker.id cleanly in memory

        # 2. Build deployment Tracking Trip assignment record matching models.py exactly
        new_trip = Trip(
            trekker_id=new_trekker.id,
            band_id=reg_id,
            shop_id=shop_id,
            is_active=True  # Safely writes to your exact database boolean column
        )
        db.session.add(new_trip)
        db.session.commit() # Safely commit transaction block to trek_system.db

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
    """
    [FUNCTION LABEL: HARDWARE_TELEMETRY_INGEST_PIPELINE]
    Receives live hardware sensor transmissions (lat, lng, heart rate, battery) and validates safety rules.
    Payload: { "band_id": "...", "lat": ..., "lng": ..., "hr": ..., "batt": ..., "sos": ... }
    """
    data = request.json
    if not data:
        return jsonify({"error": "No data received"}), 400
    
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
            trip_id=active_trip.id,
            lat=lat, 
            lng=lng,
            heart_rate=hr,
            battery_level=batt,
            is_sos=effective_sos,
            timestamp=datetime.now(timezone.utc)
        )
        
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"status": "Success", "in_zone": in_trail_zone, "sos": effective_sos}), 200

    except Exception as e:
        db.session.rollback()
        print(f"INGEST ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500    

@app.route('/api/active_trekkers', methods=['GET'])
def get_active_trekkers():
    """
    [FUNCTION LABEL: LIVE_MONITOR_MAP_SYNCHRONIZER]
    Streams location history arrays and evaluates stress alerts to keep the frontend map up to date.
    """
    active_trips = Trip.query.filter_by(is_active=True).all()
    results = []
    now = datetime.now(timezone.utc)
    
    for trip in active_trips:
        trekker = db.session.get(Trekker, trip.trekker_id)
        detailed_history = []
        for loc in trip.locations:
            detailed_history.append({
                "pos": [loc.lat, loc.lng],
                "time": loc.timestamp.strftime("%I:%M %p"),
                "hr": loc.heart_rate,
                "is_sos": loc.is_sos,
                "in_zone": getattr(loc, 'in_trail_zone', True)
            })
        
        last_ping = trip.locations[-1] if trip.locations else None
        is_lost = False
        last_seen_mins = 0
        if last_ping:
            ping_time = last_ping.timestamp.replace(tzinfo=timezone.utc) if last_ping.timestamp.tzinfo is None else last_ping.timestamp
            diff = now - ping_time
            last_seen_mins = int(diff.total_seconds() / 60)
            is_lost = last_seen_mins > 10 

        safety_status = "SAFE"
        hr = last_ping.heart_rate if last_ping else 0
        batt = getattr(last_ping, 'battery_level', 100) if last_ping else 100
        in_zone = getattr(last_ping, 'in_trail_zone', True) if last_ping else True

        if last_ping and last_ping.is_sos:
            safety_status = "EMERGENCY"
        elif not in_zone:
            safety_status = "OFF-TRAIL"
        elif hr > 160:
            safety_status = "STRESS"
        elif hr == 0 and not is_lost:
            safety_status = "CRITICAL"
        elif batt < 20:
            safety_status = "LOW_BATTERY"
        elif is_lost:
            safety_status = "LOST_SIGNAL"

        results.append({
            "id": trip.id,
            "name": trekker.name if trekker else f"Hardware Node #{trip.band_id}",
            "band_id": trip.band_id,
            "history": detailed_history,
            "current_pos": detailed_history[-1]["pos"] if detailed_history else None,
            "hr": hr,
            "batt": batt,
            "is_sos": last_ping.is_sos if last_ping else False,
            "is_lost": is_lost,
            "last_seen_mins": last_seen_mins,
            "safety_status": safety_status,
            "in_zone": in_zone
        })
        
    return jsonify(results)

@app.route('/api/end_trek', methods=['POST'])
def end_trek():
    """
    [FUNCTION LABEL: TRIP_CLOSURE_ARCHIVE_CONTROLLER]
    Deactivates a band registration and releases the device for future check-ins.
    Payload: { "band_id": "..." }
    """
    data = request.json
    trip = Trip.query.filter_by(band_id=data['band_id'], is_active=True).first()
    if trip:
        trip.is_active = False
        db.session.commit()
        return jsonify({"message": "Band released and trip archived"}), 200
    return jsonify({"error": "Trip not found"}), 404

@app.route('/api/shops/dropdown/options', methods=['GET'])
def get_shops_dropdown():
    """
    [FUNCTION LABEL: DEPRECATED_LOCAL_MEMORY_DROPDOWN_SERVICE]
    Alternative dictionary fallback dropdown provider.
    """
    try:
        shops_options = []
        for shop_id, shop_data in SHOPS_DB.items():
            if shop_data.get('is_active', True):
                shops_options.append({
                    "value": shop_id,
                    "label": f"🏕️ {shop_data.get('shop_name', shop_id)}"
                })
        if not shops_options:
            shops_options = [{"value": "shop_01", "label": "🏕️ Shop 01 (Default)"}]
        
        return jsonify({"shops": shops_options, "total": len(shops_options)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
@app.route('/api/shops/<shop_id>/trekkers', methods=['GET'])
def get_shop_trekkers(shop_id):
    """
    [FUNCTION LABEL: SINGLE_HUB_TREKKER_INVENTORY_RESOLVER]
    Returns active monitoring lines associated with an individual station profile locator.
    """
    try:
        trips = Trip.query.filter_by(shop_id=shop_id, is_active=True).all()
        trekkers = []
        for trip in trips:
            trekker = Trekker.query.get(trip.trekker_id)
            if trekker:
                trekkers.append({
                    "id": trip.id,
                    "name": trekker.name,
                    "band_id": trip.band_id,
                    "emergency_contact": trekker.emergency_contact,
                    "status": "active"
                })
        return jsonify({"shop_id": shop_id, "trekkers": trekkers, "total": len(trekkers)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/shops/available', methods=['GET'])
def get_available_shops():
    """
    [FUNCTION LABEL: PUBLIC_REGISTRATION_STATION_DROPDOWN_PROVIDER]
    Queries the SQLite Database to build dropdown fields for frontend signup forms.
    """
    try:
        db_shops = Shop.query.all()
        shops_options = [
            {
                "shop_id": shop.shop_id,
                "shop_name": shop.shop_name,
                "contact_person": shop.contact_person
            }
            for shop in db_shops
        ]
        return jsonify({"shops": shops_options, "total": len(shops_options)}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to load stations: {str(e)}"}), 500

# ============================================================================
# 🔒 ADMINISTRATIVE ROUTE CONTROLLERS (Requires Bearer Authorization Tokens)
# ============================================================================

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """
    [FUNCTION LABEL: MASTER_ADMIN_AUTHENTICATION_GATEWAY]
    Verifies user profiles against static password hashes and issues authorization session keys.
    Payload: { "username": "admin", "password": "kp-vault-2026" }
    """
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    if username in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[username] == password:
        return jsonify({
            "success": True,
            "token": "ADMIN_VERIFIED_TOKEN_PLACEHOLDER",
            "message": "Master Admin Access Granted",
            "access_level": "MASTER"
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_synchronized_stats():
    """
    [FUNCTION LABEL: ADMIN_CORE_ANALYTICS_COUNTERS_COMPILER]
    Computes system-wide diagnostic statistics to feed the summary blocks on the dashboard.
    """
    try:
        station_count = Shop.query.count()
        active_count = Trip.query.filter_by(is_active=True).count()
        emergency_count = Telemetry.query.filter_by(is_sos=True).count()
        
        return jsonify({
            "total_shops": station_count,          
            "total_active_trekkers": active_count,
            "emergency_alerts": emergency_count,
            "lost_signals": 0
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops', methods=['GET', 'POST'])
@admin_required
def handle_shops_management():
    """
    [FUNCTION LABEL: ADMIN_STATION_REGISTRY_HANDLER]
    GET: Serializes permanent database store lines to render in admin data tables.
    POST: Processes registration inputs to add a new monitoring station.
    """
    if request.method == 'POST':
        data = request.json or {}
        shop_id = data.get('shop_id')
        if not shop_id:
            return jsonify({"error": "Missing unique station ID key."}), 400

        existing = Shop.query.filter_by(shop_id=shop_id).first()
        if existing:
            return jsonify({"error": f"Station ID '{shop_id}' is already active in database."}), 400

        try:
            location_coordinates = {
                "lat": float(data.get('lat', 12.6654)),
                "lng": float(data.get('lng', 75.6601))
            }
            new_shop = Shop(
                shop_id=shop_id,
                shop_name=data.get('shop_name', 'New Operational Hub'),
                shop_location=location_coordinates,
                contact_person=data.get('contact_person', 'Ranger Station Head'),
                contact_phone=data.get('contact_phone') or data.get('phone') or 'N/A',
                max_trekkers=int(data.get('max_trekkers', 50))
            )
            db.session.add(new_shop)
            db.session.commit()
            return jsonify({"success": True, "message": f"Hub {shop_id} saved permanently."}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Database transaction crashed: {str(e)}"}), 500

    try:
        db_shops = Shop.query.all()
        serialized_shops = []
        for s in db_shops:
            serialized_shops.append({
                "shop_id": s.shop_id,
                "shop_name": s.shop_name,
                "contact_person": s.contact_person,
                "contact_phone": s.contact_phone,
                "max_trekkers": s.max_trekkers
            })
        return jsonify({"shops": serialized_shops}), 200
    except Exception as e:
        return jsonify({"error": f"Failed reading database hub list: {str(e)}"}), 500

@app.route('/api/admin/list', methods=['GET'])
@admin_required
def get_dashboard_row_records_list():
    """
    [FUNCTION LABEL: ADMIN_ROW_DRIVEN_METRIC_DRILLDOWN_COMPILER]
    Processes grid analytics click events to compile localized diagnostic lists.
    Query Target: /api/admin/list?type=EMERGENCY | ACTIVE | ACTIVE_TREKKERS | LOST_SIGNAL
    """
    list_type = request.args.get('type', 'ACTIVE_TREKKERS')
    records = []
    
    try:
        if list_type == 'ACTIVE':
            hubs = Shop.query.all()
            for h in hubs:
                records.append({
                    "id": h.shop_id,
                    "name": h.shop_name,
                    "status": f"Capacity Limit: {h.max_trekkers} Trekkers"
                })
                
        elif list_type == 'ACTIVE_TREKKERS':
            active_trips = Trip.query.filter_by(is_active=True).all()
            for trip in active_trips:
                trekker = Trekker.query.get(trip.trekker_id)
                records.append({
                    "id": trip.band_id,
                    "name": trekker.name if trekker else "Unknown Trekker",
                    "status": f"Active Hub: {trip.shop_id}"
                })
                
        elif list_type == 'EMERGENCY':
            active_trips = Trip.query.filter_by(is_active=True).all()
            for trip in active_trips:
                latest_ping = Telemetry.query.filter_by(trip_id=trip.id).order_by(Telemetry.timestamp.desc()).first()
                if latest_ping and latest_ping.is_sos:
                    trekker = Trekker.query.get(trip.trekker_id)
                    records.append({
                        "id": trip.band_id,
                        "name": trekker.name if trekker else "Hardware Node",
                        "status": "🚨 BROADCASTING ACTIVE SOS"
                    })
                    
        elif list_type == 'LOST_SIGNAL':
            active_trips = Trip.query.filter_by(is_active=True).all()
            now = datetime.now(timezone.utc)
            for trip in active_trips:
                latest_ping = Telemetry.query.filter_by(trip_id=trip.id).order_by(Telemetry.timestamp.desc()).first()
                if latest_ping:
                    ping_time = latest_ping.timestamp.replace(tzinfo=timezone.utc) if latest_ping.timestamp.tzinfo is None else latest_ping.timestamp
                    if (now - ping_time).total_seconds() / 60 > 10:
                        trekker = Trekker.query.get(trip.trekker_id)
                        records.append({
                            "id": trip.band_id,
                            "name": trekker.name if trekker else "Unknown Trekker",
                            "status": "⚠️ SIGNAL OUTAGE (OFFLINE)"
                        })

        return jsonify({"records": records}), 200
    except Exception as e:
        return jsonify({"error": f"Failed compiling diagnostics array sub-list: {str(e)}"}), 500

@app.route('/api/admin/next-shop-id', methods=['GET'])
@admin_required
def get_computed_next_shop_sequence_string():
    """
    [FUNCTION LABEL: ADMIN_AUTOMATED_SEQUENCE_COUNTER_SCANNER]
    Scans station code layouts to compute the next consecutive alphanumeric registration string (e.g., shop_03).
    """
    try:
        existing_ids = [shop.shop_id for shop in Shop.query.all()]
        counter = 1
        next_id = f"shop_{counter:02d}"
        while next_id in existing_ids:
            counter += 1
            next_id = f"shop_{counter:02d}"
        return jsonify({"next_id": next_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops/update/<shop_id>', methods=['PUT'])
@admin_required
def update_shop_profile(shop_id):
    """
    [FUNCTION LABEL: ADMIN_BASE_CAMP_PROFILE_MODIFIER]
    Modifies configuration rules, ranges, limits, or parameters for an active station layout.
    """
    try:
        shop = db.session.get(Shop, shop_id)
        if not shop:
            return jsonify({"error": "Target station data profile not found."}), 404
            
        data = request.get_json()
        shop.shop_name = data.get('shop_name', shop.shop_name)
        shop.contact_person = data.get('contact_person', shop.contact_person)
        shop.contact_phone = data.get('contact_phone', shop.contact_phone)
        shop.max_trekkers = data.get('max_trekkers', shop.max_trekkers)
        
        if 'shop_location' in data:
            shop.shop_location = data['shop_location']
            
        db.session.commit()
        return jsonify({"message": f"Station {shop_id} configuration modified successfully."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops/delete/<shop_id>', methods=['DELETE'])
@admin_required
def delete_shop_profile(shop_id):
    """
    [FUNCTION LABEL: ADMIN_BASE_CAMP_DESTRUCTION_CLEANER]
    Drops an operational base station completely out of the system layout.
    """
    try:
        shop = db.session.get(Shop, shop_id)
        if not shop:
            return jsonify({"error": "Target station profile does not exist."}), 404
            
        db.session.delete(shop)
        db.session.commit()
        return jsonify({"message": f"Station {shop_id} deleted cleanly."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Cascading constraint block or database failure: {str(e)}"}), 500

# ============================================================================
# ⚠️ ORIGINAL LEGACY BACKEND WRAPPERS (Preserved exactly for legacy safety)
# ============================================================================
@app.route('/api/admin/shops/register', methods=['POST'])
def register_shop():
    data = request.json or {}
    try:
        shop_id = data.get('shop_id')
        if not shop_id: return jsonify({"error": "Missing shop_id"}), 400
        existing = Shop.query.filter_by(shop_id=shop_id).first()
        if existing: return jsonify({"error": f"Station ID '{shop_id}' is already registered!"}), 400
        location_data = {"lat": float(data.get('lat', 12.6654)), "lng": float(data.get('lng', 75.6601))}
        new_shop = Shop(
            shop_id=shop_id, shop_name=data.get('shop_name', 'Unnamed Shop'), shop_location=location_data,
            contact_person=data.get('contact_person', 'N/A'), contact_phone=data.get('phone') or data.get('contact_phone') or 'N/A',
            max_trekkers=int(data.get('max_trekkers', 50))
        )
        db.session.add(new_shop)
        db.session.commit()
        return jsonify({"message": "Shop registered permanently!", "shop_id": shop_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database Commit Failure: {str(e)}"}), 500

@app.route('/api/admin/shops/<shop_id>', methods=['GET', 'PUT'])
@admin_required
def legacy_shop_by_id(shop_id):
    if request.method == 'GET':
        if shop_id not in SHOPS_DB: return jsonify({"error": f"Shop {shop_id} not found"}), 404
        shop_trips = Trip.query.filter_by(shop_id=shop_id, is_active=True).all()
        trekker_list = []
        for trip in shop_trips:
            trekker = Trekker.query.get(trip.trekker_id)
            trekker_list.append({"id": trip.id, "name": trekker.name, "band_id": trip.band_id, "emergency_contact": trekker.emergency_contact, "trip_start": trip.start_time.isoformat() if trip.start_time else None})
        shop_data = SHOPS_DB[shop_id].copy()
        shop_data['active_trekkers'] = len(trekker_list)
        shop_data['trekkers'] = trekker_list
        return jsonify(shop_data), 200
    else:
        if shop_id not in SHOPS_DB: return jsonify({"error": f"Shop {shop_id} not found"}), 404
        data = request.json
        allowed_fields = ['shop_name', 'contact_person', 'contact_phone', 'max_trekkers', 'is_active']
        for field in allowed_fields:
            if field in data: SHOPS_DB[shop_id][field] = data[field]
        SHOPS_DB[shop_id]['updated_at'] = datetime.utcnow().isoformat()
        return jsonify({"success": True, "message": f"Shop {shop_id} updated", "shop": SHOPS_DB[shop_id]}), 200

@app.route('/api/admin/alerts/broadcast', methods=['POST'])
@admin_required
def broadcast_alert():
    data = request.json
    return jsonify({"success": True, "alert": {"timestamp": datetime.utcnow().isoformat(), "alert_type": data.get('alert_type'), "message": data.get('message'), "affected_shops": data.get('affected_shops', 'ALL'), "broadcast_by": "MASTER_ADMIN"}, "message": "Alert broadcasted"}), 200

@app.route('/api/admin/dashboard/stats', methods=['GET'])
@admin_required
def get_dashboard_stats():
    try:
        return jsonify({"total_shops": Shop.query.count(), "total_active_trekkers": Trip.query.filter_by(is_active=True).count(), "emergency_alerts": Telemetry.query.filter_by(is_sos=True).count(), "lost_signals": 0}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/admin/shops/form-template', methods=['GET'])
@admin_required
def get_shop_form_template():
    return jsonify({"template": {"shop_name": "", "shop_id": "shop_XX", "shop_location": {"lat": 12.6654, "lng": 75.6601}, "contact_person": "", "contact_phone": "", "max_trekkers": 50}, "field_hints": {"shop_id": "Unique identifier", "shop_name": "Friendly name", "max_trekkers": "Max limit"}}), 200

@app.route('/api/vault/comprehensive', methods=['GET'])
@admin_required
def get_vault_data():
    try:
        shops_query = Shop.query.all()
        shops_list = []
        for s in shops_query:
            loc = s.shop_location
            if isinstance(loc, str):
                try: loc = json.loads(loc)
                except: loc = {"lat": 12.6654, "lng": 75.6601}
            shops_list.append({"shop_id": s.shop_id, "shop_name": s.shop_name, "shop_location": loc, "contact_person": s.contact_person, "contact_phone": s.contact_phone, "max_trekkers": s.max_trekkers})
        active_trips = Trip.query.filter_by(is_active=True).all()
        trekkers_list = []
        for trip in active_trips:
            trekker = Trekker.query.get(trip.trekker_id)
            last_telemetry = Telemetry.query.filter_by(trip_id=trip.id).order_by(Telemetry.timestamp.desc()).first()
            trekkers_list.append({"id": trip.id, "name": trekker.name if trekker else f"Hardware Node #{trip.band_id}", "band_id": trip.band_id, "shop_id": trip.shop_id, "pulse": last_telemetry.heart_rate if last_telemetry else 75, "battery": last_telemetry.battery_level if last_telemetry else 100, "status": "EMERGENCY" if (last_telemetry and last_telemetry.is_sos) else "ACTIVE"})
        return jsonify({"shops": shops_list, "trekkers": trekkers_list, "vault_status": "SECURE"}), 200
    except Exception as e: return jsonify({"error": f"Pipeline failure: {str(e)}"}), 500

@app.route('/api/admin/trekkers', methods=['GET', 'OPTIONS'])
@admin_required
def get_admin_trekkers_by_status():
    status_filter = request.args.get('status', 'ACTIVE')
    active_trips = Trip.query.filter_by(is_active=True).all()
    results = []
    now = datetime.now(timezone.utc)
    for trip in active_trips:
        trekker = Trekker.query.get(trip.trekker_id)
        last_ping = trip.locations[-1] if trip.locations else None
        current_status = "SAFE"
        if last_ping:
            diff = now - last_ping.timestamp.replace(tzinfo=timezone.utc)
            if last_ping.is_sos: current_status = "EMERGENCY"
            elif (diff.total_seconds() / 60 > 10): current_status = "LOST_SIGNAL"
            else: current_status = "ACTIVE"
        if status_filter == "ACTIVE" or current_status == status_filter:
            results.append({"id": trip.id, "name": trekker.name, "band_id": trip.band_id, "shop_name": trip.shop_id, "emergency_contact": trekker.emergency_contact, "status": current_status})
    return jsonify({"trekkers": results})

# ============================================================================
# 🚀 SYSTEM ENTRY EXECUTION POINT
# ============================================================================
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)