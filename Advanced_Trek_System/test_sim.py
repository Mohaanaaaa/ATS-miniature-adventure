import requests
import time
import random

BASE_URL = "http://127.0.0.1:5000/api"

TREKKERS = [
{"name": "A", "band_id": "2026000100001", "contact": "9123406780"},]

START_LAT, START_LNG = 12.6654, 75.6601
END_LAT, END_LNG = 12.6675, 75.7125

def generate_path(steps=25):
    path = []
    for i in range(steps):
        ratio = i / (steps - 1)
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
        "batt": random.randint(60, 100),
        "sos": False
    }
    try:
        response = requests.post(f"{BASE_URL}/ingest", json=payload)
        print(f"Request payload: {json.dumps(payload)}")
        print(f"Response status code: {response.status_code}")
        response_json = response.json()
        print(f"Response JSON: {response_json}")
        if response.status_code == 200:
            status = "✅" if response_json.get('status') == 'Success' else "⚠️"
            return status, "OK"
        else:
            return "❌", response_json.get('error', f"HTTP {response.status_code}")
    except Exception as e:
        return "❌", f"Error: {str(e)}"

def run_simulation():
    print("="*60)
    print("🏔️  KUMARA PARVATHA TREK SIMULATION")
    print("="*60)
    print(f"Simulating {len(TREKKERS)} trekkers moving on the trail")
    print(f"Path: {len(generate_path())} waypoints (25 total)")
    print("="*60)

    full_path = generate_path(25)

    for checkpoint_num, point in enumerate(full_path, 1):
        print(f"\n📍 CHECKPOINT {checkpoint_num}/25")
        print(f"   Coordinates: ({point['lat']:.6f}, {point['lng']:.6f})")
        print("   " + "-"*50)

        for t in TREKKERS:
            lat = point['lat'] + random.uniform(-0.0003, 0.0003)
            lng = point['lng'] + random.uniform(-0.0003, 0.0003)
            heart_rate = random.randint(85, 155)

            status, message = send_telemetry(t, lat, lng, heart_rate)
            print(f"   {status} {t['name']:10} | HR: {heart_rate:3d} bpm | "
                  f"Lat: {lat:.6f} | Lng: {lng:.6f}")

        print(f"   ⏳ Waiting 5 seconds before next checkpoint...")
        time.sleep(5)

    print("="*60)
    print("✅ TREK SIMULATION COMPLETE!")
    print("="*60)

if __name__ == "__main__":
    try:
        run_simulation()
    except KeyboardInterrupt:
        print("\n\n⚠️  Simulation interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Simulation error: {str(e)}")