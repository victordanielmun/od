"""
Re-sincroniza un mapa ya existente: NPCs (npc_templates), enemigos
(map_data.enemies) y pickups (map_pickups) a partir de su walls_json.

Por que hace falta: SaveMapConfig (POST /admin/maps) SOLO corre estos
syncs en la rama "actualizar" -- la rama "crear mapa nuevo" guarda el
walls_json tal cual pero NUNCA llama a SyncTemplatesFromMap/syncMapEnemies/
syncMapPickups (ver admin_map_handler.go). Como la Etapa 1 del pipeline
(scripts world-builder/*_build.py) siempre CREA el mapa clonado (scene_key
nuevo), cualquier `pickups` que traiga el walls_json clonado queda
"invisible" para el juego real: existe en el JSON pero nunca se copia a la
tabla map_pickups, que es de donde GET /inventory/pickups/:scene realmente
lee (ver map_pickup_handler.go). Sintoma: el mapa se ve bien en el editor
pero no aparecen items jugables.

Fix: un PUT /admin/maps/:id con el walls_json SIN cambios -- toma la rama
"actualizar" y dispara los 3 syncs.

Uso:
    python resync_map.py <scene_key> [<scene_key> ...]
"""
import sys

from _client import call, login, must

TOKEN = login()

scene_keys = sys.argv[1:]
if not scene_keys:
    print("Uso: python resync_map.py <scene_key> [<scene_key> ...]")
    raise SystemExit(1)

status, allMaps = call("GET", "/admin/maps", token=TOKEN)
if status != 200:
    print(f"FAILED listando /admin/maps: {status} {allMaps}")
    raise SystemExit(1)
byScene = {m["scene_key"]: m for m in allMaps}

for scene_key in scene_keys:
    m = byScene.get(scene_key)
    if not m:
        print(f"[warn] mapa no encontrado: {scene_key}")
        continue

    status, full = call("GET", f"/maps/config?scene_key={scene_key}", token=TOKEN)
    if status != 200:
        print(f"[warn] no se pudo leer walls_json de {scene_key}: {status}")
        continue

    body = {"walls_json": full["walls_json"]}
    must("PUT", f"/admin/maps/{m['id']}", body, TOKEN, f"resync {scene_key}")

print("\n[ok] Resync disparado. Verificar con: GET /inventory/pickups/<scene_key>")
