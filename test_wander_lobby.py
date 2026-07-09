import asyncio
import websockets
import requests
import json
import random
import time
import sys
import argparse

# Force UTF-8 encoding for Windows console to handle emojis
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:3000"
WS_URL = "ws://127.0.0.1:3000/ws"

class PlayerClient:
    def __init__(self, index, token, username, user_id, room_id):
        self.index = index
        self.token = token
        self.username = username
        self.user_id = user_id
        self.room_id = room_id
        self.x = random.randint(150, 450)
        self.y = random.randint(150, 450)
        self.websocket = None
        self.sent_count = 0
        self.received_count = 0
        self.connected = False

    async def run(self, duration):
        url = f"{WS_URL}?token={self.token}"
        start_time = time.time()
        
        try:
            async with websockets.connect(url) as ws:
                self.websocket = ws
                self.connected = True
                print(f"[Player {self.index:02d}] Connected as {self.username}")

                # 1. Join the room
                join_payload = {
                    "type": "join_room",
                    "payload": {
                        "room_id": self.room_id,
                        "x": self.x,
                        "y": self.y
                    }
                }
                await ws.send(json.dumps(join_payload))
                
                # Start the message receiving task
                receiver_task = asyncio.create_task(self.receive_loop())

                # 2. Wander Loop
                while time.time() - start_time < duration:
                    # Pick a random direction and step
                    direction = random.choice(["up", "down", "left", "right"])
                    step = random.randint(10, 30)
                    
                    if direction == "up":
                        self.y -= step
                    elif direction == "down":
                        self.y += step
                    elif direction == "left":
                        self.x -= step
                    elif direction == "right":
                        self.x += step

                    # Clamp boundaries (keep within a reasonable lobby size)
                    self.x = max(50, min(self.x, 800))
                    self.y = max(50, min(self.y, 800))

                    move_payload = {
                        "type": "update_position",
                        "payload": {
                            "room_id": self.room_id,
                            "x": self.x,
                            "y": self.y,
                            "direction": direction,
                            "anim": "walk",
                            "is_moving": True
                        }
                    }

                    await ws.send(json.dumps(move_payload))
                    self.sent_count += 1

                    # Sleep between 1 and 2.5 seconds to randomize movement pace
                    await asyncio.sleep(random.uniform(1.0, 2.5))

                # Clean exit: leave room
                leave_payload = {
                    "type": "leave_room",
                    "payload": {
                        "room_id": self.room_id
                    }
                }
                try:
                    await ws.send(json.dumps(leave_payload))
                except Exception:
                    pass

                # Cancel receiver task
                receiver_task.cancel()
                try:
                    await receiver_task
                except asyncio.CancelledError:
                    pass

        except Exception as e:
            print(f"[Player {self.index:02d}] Connection Error: {e}")
        finally:
            self.connected = False
            print(f"[Player {self.index:02d}] Disconnected.")

    async def receive_loop(self):
        try:
            async for message in self.websocket:
                self.received_count += 1
                # Periodically print some messages received from others to show activity
                if self.index == 1 and self.received_count % 15 == 0:
                    data = json.loads(message)
                    msg_type = data.get("type")
                    if msg_type == "position_update":
                        payload = data.get("payload", {})
                        p_username = payload.get("username", "Unknown")
                        px = payload.get("x")
                        py = payload.get("y")
                        print(f"      * [Player 01 Info] Observed {p_username} moving to ({px:.1f}, {py:.1f})")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[Player {self.index:02d} Receiver Error] {e}")


async def main():
    parser = argparse.ArgumentParser(description="Odyssey Multiplayer Lobby Wander Test")
    parser.add_argument("--players", type=int, default=30, help="Number of players to simulate")
    parser.add_argument("--duration", type=int, default=30, help="Duration of the test in seconds")
    args = parser.parse_args()

    num_players = args.players
    duration = args.duration

    print("=" * 60)
    print(f"    Odyssey Lobby Load Test: {num_players} Players Wandering    ")
    print("=" * 60)
    print(f"Targeting server: {BASE_URL}")
    print()

    # Step 1: Guest Login / Auth for 30 players
    print(f"Creating & authenticating {num_players} guest players...")
    players_data = []
    
    # We use a session for performance
    with requests.Session() as session:
        for i in range(1, num_players + 1):
            try:
                resp = session.post(f"{BASE_URL}/auth/guest", json={"character_ids": ["1", "2"]})
                resp.raise_for_status()
                data = resp.json()
                token = data["token"]
                username = data["user"]["username"]
                user_id = data["user"]["id"]
                players_data.append((i, token, username, user_id))
            except Exception as e:
                print(f"Failed to authenticate player {i}: {e}")
                print("Make sure the Go backend server is running on port 3000.")
                sys.exit(1)

    print(f"Successfully authenticated {len(players_data)} players.")
    print()

    # Step 2: Create a Room with sceneKey 'lobby' and capacity for the players
    print("Creating a temporary lobby room for testing...")
    creator_token = players_data[0][1]
    headers = {
        "Authorization": f"Bearer {creator_token}",
        "Content-Type": "application/json"
    }
    
    try:
        room_payload = {
            "name": f"Lobby Wander Test Room - {int(time.time())}",
            "maxUsers": num_players + 10,
            "isPublic": True,
            "type": "public",
            "sceneKey": "lobby"
        }
        resp = requests.post(f"{BASE_URL}/rooms", json=room_payload, headers=headers)
        resp.raise_for_status()
        room_data = resp.json()
        room_id = room_data["id"]
        print(f"Created Lobby Room successfully! ID: {room_id}")
    except Exception as e:
        print(f"Failed to create test room: {e}")
        sys.exit(1)
        
    print()
    print(f"Starting simulation of {num_players} players in room {room_id} for {duration}s...")
    print("Each player will connect via WS, join the room, and perform random moves.")
    print("-" * 60)

    # Instantiate player clients
    clients = [
        PlayerClient(index=p[0], token=p[1], username=p[2], user_id=p[3], room_id=room_id)
        for p in players_data
    ]

    # Run all player tasks concurrently
    tasks = [asyncio.create_task(client.run(duration)) for client in clients]
    
    # Wait for completion of the duration
    await asyncio.gather(*tasks)

    # Summary
    print()
    print("=" * 60)
    print("                       SIMULATION SUMMARY                ")
    print("=" * 60)
    total_sent = sum(c.sent_count for c in clients)
    total_received = sum(c.received_count for c in clients)
    successful_connections = sum(1 for c in clients if c.sent_count > 0)
    
    print(f"  * Total Simulated Players : {num_players}")
    print(f"  * Successful Connections  : {successful_connections} / {num_players}")
    print(f"  * Total Moves Sent (Upd)  : {total_sent}")
    print(f"  * Total WS Messages Recv  : {total_received}")
    print(f"  * Avg. Updates per Player : {total_sent / max(1, successful_connections):.1f}")
    print("=" * 60)
    print("Test completed successfully.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user.")
