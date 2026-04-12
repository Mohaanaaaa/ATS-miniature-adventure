import serial
import requests
import json

# 1. SETUP: Change 'COM3' to your actual port (check Device Manager)
SERIAL_PORT = 'COM3' 
BAUD_RATE = 9600
API_URL = "http://127.0.0.1:5000/api/ingest"

def start_gateway():
    try:
        # Open the connection to the physical LoRa module
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"📡 Gateway Online: Listening on {SERIAL_PORT}...")

        while True:
            if ser.in_waiting > 0:
                # Read the radio packet from the air
                line = ser.readline().decode('utf-8').strip()
                print(f"📥 Received Radio Packet: {line}")

                # Parse: ST:ID:LAT:LNG:HR:SOS
                parts = line.split(':')
                if len(parts) == 6 and parts[0] == "ST":
                    payload = {
                        "band_id": parts[1],
                        "lat": float(parts[2]),
                        "lng": float(parts[3]),
                        "hr": int(parts[4]),
                        "sos": parts[5] == "1"
                    }

                    # Push to Flask
                    response = requests.post(API_URL, json=payload)
                    if response.status_code == 200:
                        print("✅ Data synced to Dashboard")
                    else:
                        print(f"❌ Backend Error: {response.text}")

    except serial.SerialException as e:
        print(f"❌ Error: Could not open {SERIAL_PORT}. Is the LoRa module plugged in?")
    except KeyboardInterrupt:
        print("\n🛑 Gateway Shutting Down.")

if __name__ == "__main__":
    start_gateway()