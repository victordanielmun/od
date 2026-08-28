"""
Fix: los letreros de los mapas "_square" (clonados de clock_tower) se
pusieron en (450, 250) en los 15 mundos construidos (2-16) -- esa
posicion cae DENTRO del area visual de la torre del reloj (build en
(450, 150), frame sprite13, scale 2.8 -> con el renderedScale*1.25 del
TilePlacer, el sprite real mide ~336x402px centrado ahi, o sea ocupa
x:[282,618] y:[-51,351]). El letrero quedaba dibujado debajo/encima de
la torre en vez de en piso libre.

El clock_tower original SI tiene su letrero bien puesto, en (450, 550)
-- fuera del area de la torre y lejos de los 5 npcZones. Este script
mueve el letrero de cada mundo a una posicion seguridad (fuera de la
torre, lejos de NPCs, y sin pisar un tile de forest ya generado),
probando una lista de candidatos por mundo (los mapas de bosque
proceduralmente generado son distintos por mundo, asi que el candidato
libre puede variar).

Uso:
    python fix_sign_over_build.py            # aplica el fix
    python fix_sign_over_build.py --dry-run  # solo reporta que haria
"""
import json
import sys

from _client import call, login, must

TOKEN = login()
DRY_RUN = "--dry-run" in sys.argv

SQUARE_SCENES = [
    "pronoun_square", "career_square", "subject_be_square", "itis_square",
    "negative_square", "question_square", "possessive_square", "twofold_square",
    "daily_square", "nevergreen_square", "doesit_square", "thereis_square",
    "color_square", "animal_square", "family_square",
]

# Area visual de la torre (build en 450,150, sprite13 96x115, scale 2.8,
# TilePlacer renderedScale = scale*1.25 = 3.5 -> 336x402.5, centrado).
BUILD_X, BUILD_Y = 450, 150
BUILD_HALF_W, BUILD_HALF_H = 168, 201.25

CANDIDATES = [
    (450, 550), (350, 550), (550, 550), (450, 650),
    (350, 650), (550, 650), (250, 550), (650, 550),
    (250, 650), (650, 650),
]


def in_build_zone(x, y):
    return (BUILD_X - BUILD_HALF_W <= x <= BUILD_X + BUILD_HALF_W and
            BUILD_Y - BUILD_HALF_H <= y <= BUILD_Y + BUILD_HALF_H)


def near_npc(x, y, npcZones, radius=90):
    return any((x - n["x"]) ** 2 + (y - n["y"]) ** 2 < radius ** 2 for n in npcZones)


def occupied_by_forest(x, y, forest):
    return any(f["x"] == x and f["y"] == y for f in forest)


results = []
for scene in SQUARE_SCENES:
    status, cfg = call("GET", f"/maps/config?scene_key={scene}", token=TOKEN)
    if status != 200:
        print(f"[WARN] no pude leer {scene}: {status}")
        continue
    data = json.loads(cfg["walls_json"])
    furniture = data.get("furniture", [])
    signs = [f for f in furniture if f.get("minigameType") == "read"]
    if len(signs) != 1:
        print(f"[WARN] {scene} tiene {len(signs)} letreros (se esperaba 1), reviso manualmente")
        continue
    sign = signs[0]
    sx, sy = sign["x"], sign["y"]
    if not in_build_zone(sx, sy):
        print(f"[skip] {scene}: letrero en ({sx},{sy}) ya esta fuera de la torre")
        continue

    npcZones = data.get("npcZones", [])
    forest = data.get("forest", [])
    chosen = None
    for cx, cy in CANDIDATES:
        if in_build_zone(cx, cy):
            continue
        if near_npc(cx, cy, npcZones):
            continue
        if occupied_by_forest(cx, cy, forest):
            continue
        chosen = (cx, cy)
        break

    if not chosen:
        print(f"[WARN] {scene}: no encontre candidato libre, reviso manualmente")
        continue

    print(f"{scene}: letrero ({sx},{sy}) [DENTRO DE LA TORRE] -> {chosen}")
    results.append((scene, data, sign, chosen))

print(f"\n{len(results)} mapas a corregir\n")

if not DRY_RUN:
    status, allMaps = call("GET", "/admin/maps", token=TOKEN)
    byScene = {m["scene_key"]: m for m in allMaps}
    for scene, data, sign, (nx, ny) in results:
        sign["x"], sign["y"] = nx, ny
        mapId = byScene[scene]["id"]
        body = {"walls_json": json.dumps(data)}
        must("PUT", f"/admin/maps/{mapId}", body, TOKEN, f"reposition sign on {scene}")
    print(f"[ok] {len(results)} letreros reposicionados fuera de la torre.")
