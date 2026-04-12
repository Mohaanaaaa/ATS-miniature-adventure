import requests

# This mimics a radio packet being caught by the gateway
data = {
    "band_id": "2026000100002",
    "lat": 12.9920,
    "lng": 77.6269,
    "hr": 70,
    "sos": False
}

r = requests.post("http://127.0.0.1:5000/api/ingest", json=data)
r = requests.get("http://127.0.0.1:5000/api/active_trekkers", json=data)
print(r.status_code) # Should return 200