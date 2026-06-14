# ============================================================================
# models.py - Safe, Production-Ready Database Schemas
# ============================================================================
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Trekker(db.Model):
    __tablename__ = 'trekker'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    # Unique 13-digit identifier used by frontend registration form
    reg_id = db.Column(db.String(13), unique=True, index=True)  
    emergency_contact = db.Column(db.String(20))

    # Safe relationship mapping - Invisible to frontend, accelerates backend
    trips = db.relationship('Trip', backref='trekker', lazy=True, cascade="all, delete-orphan")


class Trip(db.Model):
    __tablename__ = 'trip'
    
    id = db.Column(db.Integer, primary_key=True)
    trekker_id = db.Column(db.Integer, db.ForeignKey('trekker.id'))
    band_id = db.Column(db.String(13), index=True) # Indexed for zero-conflict validation checks
    
    # FIX: Reference passed cleanly to log actual row write times
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Matches your exact active tracking condition column
    is_active = db.Column(db.Boolean, default=True, index=True)
    shop_id = db.Column(db.String(50), db.ForeignKey('shop.shop_id'))

    # Cascades safely to query tracking trails cleanly without leaving orphans
    locations = db.relationship('Telemetry', backref='trip', lazy=True, cascade="all, delete-orphan")


class Shop(db.Model):
    __tablename__ = 'shop'
    
    shop_id = db.Column(db.String(50), primary_key=True)
    shop_name = db.Column(db.String(100), nullable=False)
    shop_location = db.Column(db.JSON, nullable=False) # Maps to {"lat": X, "lng": Y} on Leaflet
    contact_person = db.Column(db.String(100), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    max_trekkers = db.Column(db.Integer, nullable=False, default=50)
    
    def to_dict(self):
        """Preserves exact key structure required by AdminDashboard React components"""
        return {
            "shop_id": self.shop_id,
            "shop_name": self.shop_name,
            "shop_location": self.shop_location,
            "contact_person": self.contact_person,
            "contact_phone": self.contact_phone,
            "max_trekkers": self.max_trekkers
        }


class Telemetry(db.Model):
    __tablename__ = 'telemetry'
    
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'), index=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    heart_rate = db.Column(db.Integer)
    is_sos = db.Column(db.Boolean, default=False, index=True) # Indexed for live alert filtering
    in_trail_zone = db.Column(db.Boolean, default=True)
    battery_level = db.Column(db.Integer, default=100)
    
    # FIX: Logs true hardware coordinate reception intervals
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    shop_id = db.Column(db.String(50), db.ForeignKey('shop.shop_id'))