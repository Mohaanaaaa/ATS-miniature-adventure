from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Trekker(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    reg_id = db.Column(db.String(13), unique=True) # The 13-digit ID
    emergency_contact = db.Column(db.String(20))

class Trip(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    trekker_id = db.Column(db.Integer, db.ForeignKey('trekker.id'))
    band_id = db.Column(db.String(13))
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    # Relationship to get all locations for this trip easily
    locations = db.relationship('Telemetry', backref='trip', lazy=True)
    shop_id=db.Column(db.String(10), db.ForeignKey('shop.shop_id'))

class Shop(db.Model):
    shop_id = db.Column(db.String(10), primary_key=True)
    shop_name = db.Column(db.String(100), nullable=False)
    shop_location = db.Column(db.JSON, nullable=False)
    contact_person = db.Column(db.String(100), nullable=False)
    contact_phone = db.Column(db.String(20), nullable=False)
    max_trekkers = db.Column(db.Integer, nullable=False)

class Telemetry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    heart_rate = db.Column(db.Integer)
    is_sos = db.Column(db.Boolean, default=False)
    in_trail_zone = db.Column(db.Boolean, default=True) # ADD THIS[cite: 7, 9]
    battery_level = db.Column(db.Integer, default=100) # ADD THIS[cite: 7, 9]
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)