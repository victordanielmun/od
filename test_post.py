import requests
import traceback
try:
    print("Sending POST request to localhost:8001...")
    r = requests.post(
        'http://localhost:8001/api/analyze/audio',
        data={'challenge_id': '6c4341c5-db84-4191-8afc-fc2e7adbb51f'},
        files={'audio': open('gather-rpg-frontend/public/vite.svg', 'rb')}
    )
    print("Status Code:", r.status_code)
    print("Response Body:", r.text)
except Exception as e:
    print("Request failed:", e)
    traceback.print_exc()
