import time
import requests
import sys

# Force UTF-8 encoding for Windows console to handle emojis
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:3000"

def run_benchmark():
    print("=" * 60)
    print("      Odyssey Dialogue & TTS E2E Latency Benchmark      ")
    print("=" * 60)
    print("Connecting to backend at:", BASE_URL)
    print()

    # Step 1: Guest Login / Auth
    start = time.perf_counter()
    try:
        resp = requests.post(f"{BASE_URL}/auth/guest", json={"character_ids": ["1", "2"]})
        resp.raise_for_status()
        auth_data = resp.json()
        token = auth_data["token"]
        login_ms = (time.perf_counter() - start) * 1000
        print(f"[1/6] Auth (Guest Login)  : SUCCESS | {login_ms:.2f} ms")
    except Exception as e:
        print(f"[1/6] Auth (Guest Login)  : FAILED  | Error: {e}")
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 2: Create a Temporary Room
    start = time.perf_counter()
    try:
        room_payload = {
            "name": "Benchmark Room Temp",
            "maxUsers": 10,
            "isPublic": True,
            "type": "public",
            "sceneKey": "lobby"
        }
        resp = requests.post(f"{BASE_URL}/rooms", json=room_payload, headers=headers)
        resp.raise_for_status()
        room_data = resp.json()
        room_id = room_data["id"]
        room_ms = (time.perf_counter() - start) * 1000
        print(f"[2/6] Room Creation       : SUCCESS | {room_ms:.2f} ms (Room ID: {room_id})")
    except Exception as e:
        print(f"[2/6] Room Creation       : FAILED  | Error: {e}")
        sys.exit(1)

    # Step 3: Fetch NPCs in the room
    start = time.perf_counter()
    try:
        resp = requests.get(f"{BASE_URL}/rooms/{room_id}/npcs?scene_key=lobby", headers=headers)
        resp.raise_for_status()
        npcs = resp.json()
        
        if not npcs or len(npcs) == 0:
            # Fallback template ID if room instances are empty
            npc_template_id = 9
            print(f"[3/6] Fetch Room NPCs     : EMPTY   | Using fallback Template ID: {npc_template_id}")
        else:
            npc_template_id = npcs[0]["npc_template_id"]
            print(f"[3/6] Fetch Room NPCs     : SUCCESS | {(time.perf_counter() - start)*1000:.2f} ms (Found NPC Template ID: {npc_template_id})")
    except Exception as e:
        print(f"[3/6] Fetch Room NPCs     : FAILED  | Error: {e}")
        sys.exit(1)

    # Step 4: Call Go Backend Dialogue (LLM Call)
    start = time.perf_counter()
    player_input = "Hello! Nice to meet you."
    dialogue_payload = {
        "room_id": room_id,
        "npc_template_id": npc_template_id,
        "player_input": player_input,
        "pronunciation_score": 100
    }
    
    npc_response_text = ""
    try:
        resp = requests.post(f"{BASE_URL}/npc/dialogue", json=dialogue_payload, headers=headers)
        resp.raise_for_status()
        diag_data = resp.json()
        npc_response_text = diag_data["npc_response"]
        dialogue_ms = (time.perf_counter() - start) * 1000
        print(f"[4/6] Dialogue (LLM Call) : SUCCESS | {dialogue_ms:.2f} ms")
        print(f"      * Input  : \"{player_input}\"")
        print(f"      * Output : \"{npc_response_text}\"")
    except Exception as e:
        print(f"[4/6] Dialogue (LLM Call) : FAILED  | Error: {e}")
        sys.exit(1)

    if not npc_response_text:
        npc_response_text = "Hello, nice to meet you too traveler."

    # Step 5: Call Go Backend TTS Generation (Piper Local)
    start = time.perf_counter()
    tts_payload = {
        "text": npc_response_text,
        "voice": "en-US-RogerNeural"
    }
    
    cache_key = ""
    try:
        resp = requests.post(f"{BASE_URL}/tts/generate", json=tts_payload, headers=headers)
        if resp.status_code != 200:
            print(f"[5/6] TTS Generate (Piper): FAILED  | Response body: {resp.text}")
            sys.exit(1)
        resp.raise_for_status()
        tts_data = resp.json()
        cache_key = tts_data["cache_key"]
        tts_gen_ms = (time.perf_counter() - start) * 1000
        print(f"[5/6] TTS Generate (Piper): SUCCESS | {tts_gen_ms:.2f} ms (Cache Key: {cache_key})")
    except Exception as e:
        print(f"[5/6] TTS Generate (Piper): FAILED  | Error: {e}")
        sys.exit(1)

    # Step 6: Fetch Audio File Binary
    start = time.perf_counter()
    try:
        resp = requests.get(f"{BASE_URL}/tts/audio/{cache_key}")
        resp.raise_for_status()
        audio_content = resp.content
        audio_ms = (time.perf_counter() - start) * 1000
        print(f"[6/6] TTS Audio Fetch     : SUCCESS | {audio_ms:.2f} ms (Downloaded: {len(audio_content)} bytes)")
    except Exception as e:
        print(f"[6/6] TTS Audio Fetch     : FAILED  | Error: {e}")
        sys.exit(1)

    print()
    print("=" * 60)
    print("                       BENCHMARK SUMMARY                ")
    print("=" * 60)
    print(f"  * Auth Setup          : {login_ms:.2f} ms")
    print(f"  * Room Creation       : {room_ms:.2f} ms")
    print(f"  * LLM Dialogue Request: {dialogue_ms:.2f} ms  <-- (LLM processing)")
    print(f"  * TTS Piper Generation: {tts_gen_ms:.2f} ms  <-- (Piper synthesis)")
    print(f"  * Audio Streaming     : {audio_ms:.2f} ms  <-- (File retrieval)")
    print("-" * 60)
    total_flow = dialogue_ms + tts_gen_ms + audio_ms
    print(f"  * E2E Loop Latency    : {total_flow:.2f} ms")
    print("=" * 60)

if __name__ == "__main__":
    run_benchmark()
