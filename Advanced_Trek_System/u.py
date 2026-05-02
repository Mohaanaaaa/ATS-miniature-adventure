import requests
import time
import random
import json

# API Endpoints
BASE_URL = "http://127.0.0.1:5000/api"

# 4 Trekkers with unique Band IDs
TREKKERS = [
    {"name": "A", "band_id": "2026000100002", "contact": "9123406788"},
    
]

# Generated 25 coordinates from Base to Peak
START_LAT, START_LNG = 12.6654, 75.6601
END_LAT, END_LNG = 12.6675, 75.7125

def generate_path(steps=25):
    """Generate path from start to end with slight variations"""
    path = []
    for i in range(steps):
        # Linear interpolation with slight random curves
        ratio = i / (steps - 1)
        lat = START_LAT + (END_LAT - START_LAT) * ratio + random.uniform(-0.001, 0.001)
        lng = START_LNG + (END_LNG - START_LNG) * ratio + random.uniform(-0.001, 0.001)
        path.append({"lat": lat, "lng": lng})
    return path

def register_trekkers():
    """Register all trekkers"""
    print("\n" + "="*60)
    print("📝 REGISTERING TREKKERS")
    print("="*60)
    
    for t in TREKKERS:
        payload = {
            "name": t['name'],
            "reg_id": t['band_id'],
            "emergency_contact": t['contact'],
            "shop_id": "shop_01"  # ✅ IMPORTANT: Add shop_id
        }
        
        try:
            response = requests.post(f"{BASE_URL}/start_trek", json=payload)
            
            if response.status_code == 201:
                data = response.json()
                print(f"✅ {t['name']:12} - Band ID: {t['band_id']} - Registered Successfully")
            elif response.status_code == 400:
                error_data = response.json()
                print(f"⚠️  {t['name']:12} - {error_data.get('error', 'Registration failed')}")
            else:
                print(f"❌ {t['name']:12} - HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ {t['name']:12} - Connection Error: {str(e)}")

def send_telemetry(trekker, lat, lng, heart_rate):
    """Send location and heart rate data for a trekker"""
    payload = {
        "band_id": trekker['band_id'],
        "lat": lat,
        "lng": lng,
        "hr": heart_rate,
        "batt": random.randint(60, 100),  # Battery percentage
        "sos": False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/ingest", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            status = "✅" if data.get('status') == 'Success' else "⚠️"
            return status, "OK"
        else:
            error_data = response.json()
            return "❌", error_data.get('error', f'HTTP {response.status_code}')
            
    except Exception as e:
        return "❌", f"Error: {str(e)}"

def run_simulation():
    """Run the main simulation"""
    print("\n" + "="*60)
    print("🏔️  KUMARA PARVATHA TREK SIMULATION")
    print("="*60)
    print(f"Simulating {len(TREKKERS)} trekkers moving on the trail")
    print(f"Path: {len(generate_path())} waypoints (25 total)")
    print("="*60)
    
    # Step 1: Register all trekkers
    register_trekkers()
    
    # Step 2: Simulate movement
    print("\n" + "="*60)
    print("🚶 TREKKERS MOVING ALONG TRAIL")
    print("="*60)
    
    full_path = generate_path(25)
    
    for checkpoint_num, point in enumerate(full_path, 1):
        print(f"\n📍 CHECKPOINT {checkpoint_num}/25")
        print(f"   Coordinates: ({point['lat']:.6f}, {point['lng']:.6f})")
        print("   " + "-"*50)
        
        for t in TREKKERS:
            # Add jitter to simulate slightly different positions
            lat = point['lat'] + random.uniform(-0.0003, 0.0003)
            lng = point['lng'] + random.uniform(-0.0003, 0.0003)
            heart_rate = random.randint(85, 155)
            
            status, message = send_telemetry(t, lat, lng, heart_rate)
            
            # Format output
            print(f"   {status} {t['name']:10} | HR: {heart_rate:3d} bpm | "
                  f"Lat: {lat:.6f} | Lng: {lng:.6f}")
        
        # Wait before next checkpoint (reduce from 30 to 5 seconds for faster testing)
        print(f"   ⏳ Waiting 5 seconds before next checkpoint...")
        time.sleep(5)
    
    # Step 3: Simulation complete
    print("\n" + "="*60)
    print("✅ TREK SIMULATION COMPLETE!")
    print("="*60)
    print(f"✅ All {len(TREKKERS)} trekkers completed the trail")
    print("✅ Check the map to see tracked paths")
    print("="*60 + "\n")

if __name__ == "__main__":
    try:
        run_simulation()
    except KeyboardInterrupt:
        print("\n\n⚠️  Simulation interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Simulation error: {str(e)}")