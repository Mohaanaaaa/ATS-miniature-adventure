# ============================================================================
# models.py - Persistent Database Schemas
# ============================================================================
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Trekker(db.Model):
    __tablename__ = 'trekker'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    reg_id = db.Column(db.String(13), unique=True)  # The unique 13-digit identifier
    emergency_contact = db.Column(db.String(20))

class Trip(db.Model):
    __tablename__ = 'trip'
    id = db.Column(db.Integer, primary_key=True)
    trekker_id = db.Column(db.Integer, db.ForeignKey('trekker.id'))
    band_id = db.Column(db.String(13))
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    shop_id = db.Column(db.String(50), db.ForeignKey('shop.shop_id'))

    # Cascade relationship to query tracking trails safely
    locations = db.relationship('Telemetry', backref='trip', lazy=True)

class Shop(db.Model):
    __tablename__ = 'shop'
    # Expanded capacity dimension from String(10) to String(50) to handle full names cleanly
    shop_id = db.Column(db.String(50), primary_key=True)
    shop_name = db.Column(db.String(100), nullable=False)
    shop_location = db.Column(db.JSON, nullable=False)
    contact_person = db.Column(db.String(100), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    max_trekkers = db.Column(db.Integer, nullable=False, default=50)
    
    def to_dict(self):
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
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'))
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    heart_rate = db.Column(db.Integer)
    is_sos = db.Column(db.Boolean, default=False)
    in_trail_zone = db.Column(db.Boolean, default=True)
    battery_level = db.Column(db.Integer, default=100)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    shop_id = db.Column(db.String(50), db.ForeignKey('shop.shop_id'))