import requests

# Data to send
data = {
    "band_id": "2026000100001",
    "lat": 12.9716,
    "lng": 77.5946,
    "hr": 75,
    "sos": False
}

# Send POST request
response = requests.post("http://127.0.0.1:5000/api/ingest", json=data)

# Print status code
print(response.status_code)

# Optional: Print response content
print(response.text)