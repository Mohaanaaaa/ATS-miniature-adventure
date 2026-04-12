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

class Telemetry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.Integer, db.ForeignKey('trip.id'))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    heart_rate = db.Column(db.Integer)
    is_sos = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)