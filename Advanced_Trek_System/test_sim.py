import requests
import time
import random
import json  # <-- Fixed: Added missing import so json.dumps doesn't crash!

BASE_URL = "http://127.0.0.1:5000/api"

# Synced up perfectly with your React registration screenshot entry!
TREKKERS = [
    {"name": "A", "band_id": "2026000100001", "contact": "98765434"}
]

START_LAT, START_LNG = 12.6657, 75.6610
END_LAT, END_LNG = 12.6675, 75.7125

def generate_path(steps=25):
    path = []
    for i in range(steps):
        ratio = i / (steps - 1)
        # Generate a progressive path heading up the mountain trail
        lat = START_LAT + (END_LAT - START_LAT) * ratio + random.uniform(-0.001, 0.001)
        lng = START_LNG + (END_LNG - START_LNG) * ratio + random.uniform(-0.001, 0.001)
        path.append({"lat": lat, "lng": lng})
    return path

def send_telemetry(trekker, lat, lng, heart_rate):
    payload = {
        "band_id": trekker['band_id'],
        "lat": lat,
        "lng": lng,
        "hr": heart_rate,
        "battery": random.randint(75, 100),  # Synced naming convention to match React UI
        "is_sos": False                      # Matches your frontend model parameters
    }
    try:
        # Pushing straight to your active telemetry ingestion layer
        response = requests.post(f"{BASE_URL}/ingest", json=payload, timeout=3)
        
        # Verbose terminal printouts so you can track database state updates live
        print(f"   [Payload]: {json.dumps(payload)}")
        
        if response.status_code == 200:
            return "✅", "OK"
        else:
            try:
                err_msg = response.json().get('error', f"HTTP {response.status_code}")
            except:
                err_msg = f"HTTP {response.status_code}"
            return "⚠️", err_msg
    except Exception as e:
        return "❌", f"Connection Failed: {str(e)}"

def run_simulation():
    print("="*60)
    print("🏔️  KUMARA HILLS SAFETY MONITOR - TRAIL SIMULATION")
    print("="*60)
    print(f"Tracking {len(TREKKERS)} registered band(s) along the vector path.")
    print("="*60)

    full_path = generate_path(25)

    for checkpoint_num, point in enumerate(full_path, 1):
        print(f"\n📍 STEP PING {checkpoint_num}/25")
        print(f"   Center Coordinates: ({point['lat']:.6f}, {point['lng']:.6f})")
        print("   " + "-" * 52)

        for t in TREKKERS:
            # Inject slight drift variance to emulate real IoT GPS fluctuations
            lat = point['lat'] + random.uniform(-0.0002, 0.0002)
            lng = point['lng'] + random.uniform(-0.0002, 0.0002)
            heart_rate = random.randint(95, 145)  # Realistic trekking pulse range

            status, msg = send_telemetry(t, lat, lng, heart_rate)
            print(f"   {status} Trekker: {t['name']} | Pulse: {heart_rate} BPM | Msg: {msg}")

        print(f"   ⏳ Sync complete. Waiting 5s before next ping loop...")
        time.sleep(10)

    print("\n" + "="*60)
    print("🏁 SIMULATION ROUTE COMPLETE - DATA PIPELINE IDLE")
    print("="*60)

if __name__ == "__main__":
    try:
        run_simulation()
    except KeyboardInterrupt:
        print("\n\n⚠️ Simulation halted via console command.")