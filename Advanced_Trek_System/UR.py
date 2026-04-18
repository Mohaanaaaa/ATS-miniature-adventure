import requests
import time
import random

# API Endpoints
BASE_URL = "http://127.0.0.1:5000/api"

# 4 Trekkers with unique Band IDs
TREKKERS = [
    {"name": "A", "band_id": "2026000100001", "contact": "9123456780"},
    {"name": "B", "band_id": "2026000100002", "contact": "9123456781"},
    {"name": "C", "band_id": "2026000100003", "contact": "9123456782"},
    {"name": "D", "band_id": "2026000100004", "contact": "9123456783"}
]

# Generated 25 coordinates from Base to Peak
START_LAT, START_LNG = 12.6654, 75.6601
END_LAT, END_LNG = 12.6675, 75.7125

# Path points from Kukke Entrance towards the Peak
'''PATH_WAYPOINTS = [
    {"lat": 12.6654, "lng": 75.6601}, # Kukke Entrance
    {"lat": 12.6685, "lng": 75.6720}, # Forest Entry
    {"lat": 12.6715, "lng": 75.6820}, # Bhattara Mane
    {"lat": 12.6620, "lng": 75.7010}  # Sesha Parvatha
]'''
def generate_path(steps=25):
    path = []
    for i in range(steps):
        # Linear interpolation with slight random curves
        ratio = i / (steps - 1)
        lat = START_LAT + (END_LAT - START_LAT) * ratio + random.uniform(-0.001, 0.001)
        lng = START_LNG + (END_LNG - START_LNG) * ratio + random.uniform(-0.001, 0.001)
        path.append({"lat": lat, "lng": lng})
    return path

def run_simulation():
    full_path = generate_path(25)
    
    # Register
    for t in TREKKERS:
        requests.post(f"{BASE_URL}/start_trek", json={
            "name": t['name'], "reg_id": t['band_id'], "emergency_contact": t['contact']
        })

    # Move
    for i, point in enumerate(full_path):
        print(f"--- Checkpoint {i+1}/25 ---")
        for t in TREKKERS:
            payload = {
                "band_id": t['band_id'],
                "lat": point['lat'] + random.uniform(-0.0002, 0.0002),
                "lng": point['lng'] + random.uniform(-0.0002, 0.0002),
                "hr": random.randint(90, 150),
                "sos": False
            }
            requests.post(f"{BASE_URL}/ingest", json=payload)
        time.sleep(30) # Move every 30 seconds for testing
        
'''def run_simulation():
    print("--- 🚀 Initializing 4-Person Trek Simulation ---")
    
    # Step 1: Register all trekkers one by one
    for t in TREKKERS:
        response = requests.post(f"{BASE_URL}/start_trek", json={
            "name": t['name'],
            "reg_id": t['band_id'],
            "emergency_contact": t['contact']
        })
        if response.status_code == 201:
            print(f"✅ Registered: {t['name']} ({t['band_id']})")
        else:
            print(f"⚠️ {t['name']} already active or registration failed.")

    # Step 2: Loop through coordinates to simulate movement
    print("\n--- 🚶 Trekkers are moving toward the Peak ---")
    for point in PATH_WAYPOINTS:
        for t in TREKKERS:
            # Add a small random jitter so they aren't exactly on top of each other
            lat_jitter = point['lat'] + random.uniform(-0.0005, 0.0005)
            lng_jitter = point['lng'] + random.uniform(-0.0005, 0.0005)
            
            payload = {
                "band_id": t['band_id'],
                "lat": lat_jitter,
                "lng": lng_jitter,
                "hr": random.randint(85, 145), # Simulated heart rate
                "sos": False
            }
            
            requests.post(f"{BASE_URL}/ingest", json=payload)
            print(f"📡 {t['name']} pinged: {lat_jitter:.4f}, {lng_jitter:.4f} | HR: {payload['hr']}")
            
        print("-" * 30)
        time.sleep(15) # Wait 15 seconds before the next movement step'''

if __name__ == "__main__":
    run_simulation()