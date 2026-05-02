from sqlite3 import OperationalError
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Trekker, Trip, Telemetry
import math
from datetime import datetime, timezone
from functools import wraps
import secrets
import json
from sqlalchemy.exc import IntegrityError
import time  # Crucial for your retry logic


app = Flask(__name__)
CORS(app)

# Configuration for SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///trek_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Shop Management Database
SHOPS_DB = {}  # In production, use SQLAlchemy model
ADMIN_CREDENTIALS = {
    "admin": "kp-vault-2026"  # username: password (change in production!)
}

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

# --- UPDATE IN start_trek ROUTE ---
@app.route('/api/start_trek', methods=['POST'])
def start_trek():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    reg_id = data.get('reg_id')
    name = data.get('name')
    emergency = data.get('emergency_contact')
    shop_id = data.get('shop_id', 'shop_01')
    
    try:
        # 1. Handle Trekker (Create if doesn't exist)
        trekker = Trekker.query.filter_by(reg_id=reg_id).first()
        if not trekker:
            trekker = Trekker(
                name=name,
                reg_id=reg_id,
                emergency_contact=emergency
            )
            db.session.add(trekker)
            db.session.flush() # Get the ID without committing yet

        # 2. Handle Trip (Check for active ones)
        existing_trip = Trip.query.filter_by(band_id=reg_id, is_active=True).first()
        if existing_trip:
            return jsonify({
                "message": "Trekker is already active", 
                "trip_id": existing_trip.id
            }), 200
 
        # 3. Start NEW trip with compatible UTC
        new_trip = Trip(
            trekker_id=trekker.id, 
            band_id=reg_id,
            shop_id=shop_id,
            start_time=datetime.now(timezone.utc), # FIX: Use timezone.utc
            is_active=True
        )
        db.session.add(new_trip)
        db.session.commit()
        
        return jsonify({"message": "Trekker registered and band activated!", "trip_id": new_trip.id}), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"CRITICAL ERROR: {str(e)}") # This will show in your terminal
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500
    
'''def start_trek():
    data = request.json
    shop_id = data.get('shop_id', 'default_shop') # Track which shop is registering
    try:
        # Check if band is already active elsewhere
        existing_trip = Trip.query.filter_by(band_id=data['reg_id'], is_active=True).first()
        if existing_trip:
            return jsonify({"error": "This Band ID is already assigned to another trekker"}), 400
        new_trip = Trip(
            trekker_id=new_trekker.id, 
            band_id=data['reg_id'],
            shop_id=shop_id # Save the shop identity
        )
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
        return jsonify({"error": str(e)}), 500'''

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
'''@app.route('/api/ingest', methods=['POST'])
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
        in_safe_zone = False
        for area in KUMARA_TRAIL:
            dist = calculate_distance(area['lat'], area['lng'], lat, lng)
            if dist <= area['radius']:
                in_safe_zone = True
                break
        
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
                    heart_rate=hr, battery_level=battery, is_sos=effective_sos, in_trail_zone=in_trail_zone, timestamp=datetime.utcnow()  # ← ADD THIS

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
        return jsonify({"error": str(e)}), 400'''
# ============================================================================
# REPLACEMENT CODE FOR ingest_data() FUNCTION
# Location in app.py: Lines 213-277
# 
# INSTRUCTIONS:
# 1. Open app.py
# 2. Find: @app.route('/api/ingest', methods=['POST'])
# 3. Delete everything from that line through the end of the function
# 4. Paste this entire code block
# 5. Save file
# 6. Restart: python app.py
# 7. Run: python u.py
# ============================================================================

@app.route('/api/ingest', methods=['POST'])
def ingest_data():
    data = request.json
    if not data:
        return jsonify({"error": "No data received"}), 400
    
    band_id = data.get('band_id')
    
    # 1. Validation and Lookup
    active_trip = Trip.query.filter_by(band_id=band_id, is_active=True).first()
    if not active_trip:
        return jsonify({"error": f"Band {band_id} not active"}), 404

    try:
        # Convert coordinates safely
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        hr = int(data.get('hr', 0))
        batt = data.get('batt', 100)
        manual_sos = data.get('sos', False)
        
        # 2. Safety Logic (Geofencing)
        master_dist = calculate_distance(MASTER_BORDER['lat'], MASTER_BORDER['lng'], lat, lng)
        in_trail_zone = any(calculate_distance(z['lat'], z['lng'], lat, lng) <= z['radius'] for z in KUMARA_TRAIL)
        
        # SOS trigger conditions
        effective_sos = manual_sos or (master_dist > MASTER_BORDER['radius']) or (not in_trail_zone)
        
        # 3. Database Entry with Retry Logic[cite: 8]
        new_log = Telemetry(
            trip_id=active_trip.id,
            lat=lat, 
            lng=lng,
            heart_rate=hr,
            battery_level=batt,
            is_sos=effective_sos,
            timestamp=datetime.now(timezone.utc) # Use the compatible UTC method
        )
        
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"status": "Success", "in_zone": in_trail_zone, "sos": effective_sos}), 200

    except Exception as e:
        db.session.rollback()
        print(f"INGEST ERROR: {str(e)}") # This helps you see the error in your terminal
        return jsonify({"error": str(e)}), 500    

# 3. Get All Active Trekkers for Map
@app.route('/api/active_trekkers', methods=['GET'])
def get_active_trekkers():
    active_trips = Trip.query.filter_by(is_active=True).all()
    results = []
    
    # Use timezone-aware UTC to match our ingest logic
    now = datetime.now(timezone.utc)
    
    for trip in active_trips:
        trekker = Trekker.query.get(trip.trekker_id)
        
        detailed_history = []
        for loc in trip.locations:
            detailed_history.append({
                "pos": [loc.lat, loc.lng],
                "time": loc.timestamp.strftime("%I:%M %p"),
                "hr": loc.heart_rate,
                "is_sos": loc.is_sos,
                "in_zone": getattr(loc, 'in_trail_zone', True) # Handle new column safely
            })
        
        last_ping = trip.locations[-1] if trip.locations else None
        
        # 1. Basic Connection Logic
        is_lost = False
        last_seen_mins = 0
        if last_ping:
            # Ensure last_ping.timestamp is compared correctly
            ping_time = last_ping.timestamp.replace(tzinfo=timezone.utc) if last_ping.timestamp.tzinfo is None else last_ping.timestamp
            diff = now - ping_time
            last_seen_mins = int(diff.total_seconds() / 60)
            is_lost = last_seen_mins > 10 

        # 2. Safety Status Logic (High Priority)
        # This determines the "Alert Level" for the Admin Dashboard
        safety_status = "SAFE"
        hr = last_ping.heart_rate if last_ping else 0
        batt = getattr(last_ping, 'battery_level', 100) if last_ping else 100
        in_zone = getattr(last_ping, 'in_trail_zone', True) if last_ping else True

        if last_ping and last_ping.is_sos:
            safety_status = "EMERGENCY"
        elif not in_zone:
            safety_status = "OFF-TRAIL"
        elif hr > 160: # Threshold for high physical exertion[cite: 7]
            safety_status = "STRESS"
        elif hr == 0 and not is_lost:
            safety_status = "CRITICAL" # Heart rate sensor might have detached or zero reading
        elif batt < 20:
            safety_status = "LOW_BATTERY"
        elif is_lost:
            safety_status = "LOST_SIGNAL"

        # 3. Compile the response
        results.append({
            "id": trip.id,
            "name": trekker.name,
            "band_id": trip.band_id,
            "history": detailed_history,
            "current_pos": detailed_history[-1]["pos"] if detailed_history else None,
            "hr": hr,
            "batt": batt,
            "is_sos": last_ping.is_sos if last_ping else False,
            "is_lost": is_lost,
            "last_seen_mins": last_seen_mins,
            "safety_status": safety_status, # NEW: Drive UI colors with this!
            "in_zone": in_zone
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

    # GET SHOPS FOR DROPDOWN (Simple - No Admin Required)
@app.route('/api/shops/dropdown/options', methods=['GET'])
def get_shops_dropdown():
    """
    Get shops formatted for dropdown selection
    NO ADMIN REQUIRED - Any user can see shop options
    """
    try:
        shops_options = []
        
        # Add all active shops from SHOPS_DB
        for shop_id, shop_data in SHOPS_DB.items():
            if shop_data.get('is_active', True):
                shops_options.append({
                    "value": shop_id,
                    "label": f"🏕️ {shop_data.get('shop_name', shop_id)}"
                })
        
        # If no shops registered, return defaults
        if not shops_options:
            shops_options = [
                {"value": "shop_01", "label": "🏕️ Shop 01 (Default)"}
            ]
        
        return jsonify({
            "shops": shops_options,
            "total": len(shops_options)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
# GET SHOP TREKKERS (Get all trekkers for a specific shop)
@app.route('/api/shops/<shop_id>/trekkers', methods=['GET'])
def get_shop_trekkers(shop_id):
    """Get all active trekkers registered with a specific shop"""
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
        
        return jsonify({
            "shop_id": shop_id,
            "trekkers": trekkers,
            "total": len(trekkers)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 


# 5. Shop Management API
# ============================================================================
# HELPER FUNCTION: JWT-like Token Management
# ============================================================================
def generate_admin_token():
    """Generate a secure token for admin session"""
    return secrets.token_urlsafe(32)
 
def verify_admin_token(token):
    """Verify admin token (simplified - use JWT in production)"""
    # In production, decode JWT token here
    return token == "ADMIN_VERIFIED_TOKEN_PLACEHOLDER"
 
# ============================================================================
# DECORATOR: Protect admin-only routes
# ============================================================================
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token or not verify_admin_token(token):
            return jsonify({"error": "Unauthorized access"}), 403
        return f(*args, **kwargs)
    return decorated_function
 
# ============================================================================
# 1. ADMIN LOGIN ROUTE (Master Admin Authentication)
# ============================================================================
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """
    Master Admin Login - Returns session token
    Request: { "username": "admin", "password": "kp-vault-2026" }
    """
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[username] == password:
        # In production, use JWT.encode() with secret key
        token = "ADMIN_VERIFIED_TOKEN_PLACEHOLDER"  # Simplified for demo
        return jsonify({
            "success": True,
            "token": token,
            "message": "Master Admin Access Granted",
            "access_level": "MASTER"
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401
 
# ============================================================================
# 2. SHOP REGISTRATION ROUTE (Create New Shop)
# ============================================================================
@app.route('/api/admin/shops/register', methods=['POST'])
@admin_required
def register_shop():
    """
    Create a new shop entry in the system
    Request: {
        "shop_name": "Kukke Base Camp",
        "shop_id": "shop_01",
        "shop_location": {"lat": 12.6654, "lng": 75.6601},
        "contact_person": "John Doe",
        "contact_phone": "+91-9876543210",
        "max_trekkers": 50
    }
    """
    data = request.json
    shop_id = data.get('shop_id')
    
    # Prevent duplicate shop IDs
    if shop_id in SHOPS_DB:
        return jsonify({"error": f"Shop {shop_id} already exists"}), 400
    
    try:
        SHOPS_DB[shop_id] = {
            "shop_id": shop_id,
            "shop_name": data.get('shop_name'),
            "shop_location": data.get('shop_location'),
            "contact_person": data.get('contact_person'),
            "contact_phone": data.get('contact_phone'),
            "max_trekkers": data.get('max_trekkers', 50),
            "created_at": datetime.utcnow().isoformat(),
            "is_active": True,
            "active_trekkers": 0
        }
        
        return jsonify({
            "success": True,
            "message": f"Shop {shop_id} registered successfully",
            "shop": SHOPS_DB[shop_id]
        }), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
# ============================================================================
# 3. GET ALL SHOPS (Master Admin Only)
# ============================================================================
@app.route('/api/admin/shops', methods=['GET'])
@admin_required
def get_all_shops():
    """Get all registered shops - Master Admin only"""
    return jsonify({
        "total_shops": len(SHOPS_DB),
        "shops": list(SHOPS_DB.values())
    }), 200
 
# ============================================================================
# 4. GET SINGLE SHOP DETAILS
# ============================================================================
@app.route('/api/admin/shops/<shop_id>', methods=['GET'])
@admin_required
def get_shop_details(shop_id):
    """Get detailed info about a specific shop including its trekkers"""
    if shop_id not in SHOPS_DB:
        return jsonify({"error": f"Shop {shop_id} not found"}), 404
    
    # Get all active trips for this shop
    shop_trips = Trip.query.filter_by(shop_id=shop_id, is_active=True).all()
    trekker_list = []
    
    for trip in shop_trips:
        trekker = Trekker.query.get(trip.trekker_id)
        trekker_list.append({
            "id": trip.id,
            "name": trekker.name,
            "band_id": trip.band_id,
            "emergency_contact": trekker.emergency_contact,
            "trip_start": trip.start_time.isoformat() if trip.start_time else None
        })
    
    shop_data = SHOPS_DB[shop_id].copy()
    shop_data['active_trekkers'] = len(trekker_list)
    shop_data['trekkers'] = trekker_list
    
    return jsonify(shop_data), 200
 
# ============================================================================
# 5. UPDATE SHOP INFO (Admin Only)
# ============================================================================
@app.route('/api/admin/shops/<shop_id>', methods=['PUT'])
@admin_required
def update_shop(shop_id):
    """Update shop information"""
    if shop_id not in SHOPS_DB:
        return jsonify({"error": f"Shop {shop_id} not found"}), 404
    
    data = request.json
    
    # Update only allowed fields
    allowed_fields = ['shop_name', 'contact_person', 'contact_phone', 'max_trekkers', 'is_active']
    for field in allowed_fields:
        if field in data:
            SHOPS_DB[shop_id][field] = data[field]
    
    SHOPS_DB[shop_id]['updated_at'] = datetime.utcnow().isoformat()
    
    return jsonify({
        "success": True,
        "message": f"Shop {shop_id} updated",
        "shop": SHOPS_DB[shop_id]
    }), 200
 
# ============================================================================
# 6. GLOBAL ALERTS (Master Admin - Broadcast to all shops)
# ============================================================================
@app.route('/api/admin/alerts/broadcast', methods=['POST'])
@admin_required
def broadcast_alert():
    """
    Master Admin broadcasts global alert to all shops
    Request: {
        "alert_type": "WEATHER_WARNING" | "EVACUATION" | "ALL_CLEAR",
        "message": "Heavy rain expected in 30 minutes",
        "affected_shops": ["shop_01", "shop_02"] or "ALL"
    }
    """
    data = request.json
    alert_type = data.get('alert_type')
    message = data.get('message')
    affected_shops = data.get('affected_shops', 'ALL')
    
    alert_log = {
        "timestamp": datetime.utcnow().isoformat(),
        "alert_type": alert_type,
        "message": message,
        "affected_shops": affected_shops,
        "broadcast_by": "MASTER_ADMIN"
    }
    
    # In production, store this in database and notify via WebSocket
    return jsonify({
        "success": True,
        "alert": alert_log,
        "message": f"Alert broadcasted to {affected_shops}"
    }), 200
 
# ============================================================================
# 7. DASHBOARD STATS (Master Admin Analytics)
# ============================================================================
@app.route('/api/admin/dashboard/stats', methods=['GET'])
@admin_required
def get_dashboard_stats():
    """Get system-wide statistics for Master Admin dashboard"""
    
    all_trips = Trip.query.filter_by(is_active=True).all()
    all_trekkers = Trekker.query.all()
    
    # Calculate stats
    total_active_trekkers = len(all_trips)
    total_shops = len(SHOPS_DB)
    
    sos_count = sum(1 for trip in all_trips if trip.locations and trip.locations[-1].is_sos)
    lost_signal_count = 0
    
    now = datetime.utcnow()
    for trip in all_trips:
        if trip.locations:
            last_ping = trip.locations[-1]
            diff = now - last_ping.timestamp
            if int(diff.total_seconds() / 60) > 10:
                lost_signal_count += 1
    
    return jsonify({
        "total_active_trekkers": total_active_trekkers,
        "total_shops": total_shops,
        "emergency_alerts": sos_count,
        "lost_signals": lost_signal_count,
        "system_status": "OPERATIONAL",
        "timestamp": datetime.utcnow().isoformat()
    }), 200
 
# ============================================================================
# 8. SHOP REGISTRATION PAGE HELPER (Get empty form template)
# ============================================================================
@app.route('/api/admin/shops/form-template', methods=['GET'])
@admin_required
def get_shop_form_template():
    """Returns empty form template for shop registration"""
    return jsonify({
        "template": {
            "shop_name": "",
            "shop_id": "shop_XX",
            "shop_location": {
                "lat": 12.6654,
                "lng": 75.6601
            },
            "contact_person": "",
            "contact_phone": "",
            "max_trekkers": 50
        },
        "field_hints": {
            "shop_id": "Unique identifier (e.g., shop_01, shop_02)",
            "shop_name": "Friendly name of the shop/base camp",
            "max_trekkers": "Maximum concurrent trekkers allowed"
        }
    }), 200

@app.route('/api/shops/available', methods=['GET'])
def get_available_shops():
    """
    Get all registered shops for dropdown selection
    Used by frontend to populate shop selector
    """
    try:
        # Get shops from SHOPS_DB (in-memory)
        shops_list = list(SHOPS_DB.values()) if SHOPS_DB else []
        
        # Format for dropdown
        shops_options = [
            {
                "shop_id": shop['shop_id'],
                "shop_name": shop['shop_name'],
                "contact_person": shop.get('contact_person', 'Unknown')
            }
            for shop in shops_list
        ]
        
        return jsonify({
            "shops": shops_options,
            "total": len(shops_options)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)