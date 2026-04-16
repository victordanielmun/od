import requests
import json

URL = "http://localhost:3000/npc/dialogue"
TOKEN = "YOUR_JWT_TOKEN" # I need a valid token to test

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

data = {
    "room_id": "00000000-0000-0000-0000-000000000000", # Mock UUID
    "npc_template_id": 1,
    "mission_id": 1,
    "player_input": "Hello mission master",
    "pronunciation_score": 95
}

# This is just a template. I won't run it without a token.
# But I can check the backend logs or start the server.
