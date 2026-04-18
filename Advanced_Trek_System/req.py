import requests

# This mimics a radio packet being caught by the gateway
'''data = {
    "band_id": "2026000100004",
    "lat": 12.7015,
    "lng": 77.5728,
    "hr": 77,
    "sos": False
}

r = requests.post("http://127.0.0.1:5000/api/ingest", json=data)
#r = requests.get("http://127.0.0.1:5000/api/active_trekkers", json=data)
print(r.status_code) # Should return 200

import time
import requests

# Start at base and move 1km further away every 5 seconds
current_lat = 12.9716
for i in range(60):
    current_lat += 0.01 # Moving North
    payload = {
        "band_id": "2026000100001",
        "lat": current_lat,
        "lng": 77.5946,
        "hr": 80,
        "sos": False
    }
    requests.post("http://127.0.0.1:5000/api/ingest", json=payload)
    print(f"Ping {i}: Moving further... currently at {current_lat}")
    time.sleep(10)'''
    
import requests
import time

# Starting point
current_lat = 12.9716
current_lng = 77.5946

# Movement increments
lat_increment = 0.01  # Moving North
lng_increment = 0.005  # Moving East

for i in range(60):
    # Update position
    current_lat += lat_increment
    current_lng += lng_increment

    payload = {
        "band_id": "2026000100001",
        "lat": current_lat,
        "lng": current_lng,
        "hr": 80,
        "sos": False
    }

    requests.post("http://127.0.0.1:5000/api/ingest", json=payload)
    print(f"Ping {i}: Moving further... currently at ({current_lat}, {current_lng})")
    time.sleep(15)