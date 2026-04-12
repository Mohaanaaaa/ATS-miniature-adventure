import requests
import time

# Configuration
API_URL = "http://127.0.0.1:5000/api/ingest"
BAND_ID = "2026000100002" # Ensure this matches the ID you registered in the UI

# Define a path of 4 points (Trekking from point A to B)
path_data = [
    {"lat": 12.9716, "lng": 77.5946, "hr": 78, "sos": False}, # Point 1: Starting
    {"lat": 12.9740, "lng": 77.5980, "hr": 85, "sos": False}, # Point 2: Moving
    {"lat": 12.9770, "lng": 77.6020, "hr": 10,  "sos": False}, # Point 3: BAND LOST (HR=0)
    {"lat": 12.9800, "lng": 77.6060, "hr": 110, "sos": True}  # Point 4: SOS PRESSED
]

def run_test():
    print(f"🚀 Starting Simulation for Band: {BAND_ID}")
    
    for i, point in enumerate(path_data):
        payload = {
            "band_id": BAND_ID,
            "lat": point["lat"],
            "lng": point["lng"],
            "hr": point["hr"],
            "sos": point["sos"]
        }
        
        try:
            response = requests.post(API_URL, json=payload)
            if response.status_code == 200:
                print(f"✅ Point {i+1} Sent: Lat {point['lat']}, HR {point['hr']}, SOS {point['sos']}")
            else:
                print(f"❌ Error at Point {i+1}: {response.json().get('error')}")
        except Exception as e:
            print(f"📡 Connection Failed: {e}")
        
        # Wait 5 seconds between pings so you can watch the React Map update
        print("Waiting 5 seconds for next ping...")
        time.sleep(5)

    print("\n✨ Simulation Complete! Check your Dashboard.")

if __name__ == "__main__":
    run_test()