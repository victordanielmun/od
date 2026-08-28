"""
Fix: el letrero (furniture, minigameType='read') se agrega DESPUES de
generar el bosque procedural en las Etapas 1 de cada mundo, y el codigo
nunca excluye la posicion exacta del letrero al sortear tiles de
`forest` -- asi que hay una probabilidad (~15-18%, la densidad de
forest) de que un arbol/arbusto/hongo caiga en el MISMO tile que el
letrero, quedando dibujados uno encima del otro.

Detectado con una auditoria de los 63 mapas de dialogo de los mundos
2-22 (`python -c` inline, ver conversacion) -- 5 mapas afectados:
doyou_grove, family_grove_2, house_grove_2, house_square, ing_grove_1.

Fix: quitar el tile de `forest` que coincide exactamente con la posicion
del letrero (el letrero es el elemento funcional/interactivo, el arbol
es solo decoracion -- se prioriza el letrero, igual criterio que con el
build de la torre).

Uso:
    python fix_sign_over_forest.py            # aplica el fix
    python fix_sign_over_forest.py --dry-run  # solo reporta
"""
import json
import sys

from _client import call, login, must

TOKEN = login()
DRY_RUN = "--dry-run" in sys.argv

ALL_DIALOGUE_SCENES = [
    "pronoun_village", "pronoun_village_2", "pronoun_square",
    "career_village_1", "career_village_2", "career_square",
    "you_are_village", "he_she_village", "subject_be_square",
    "itis_village_1", "itis_village_2", "itis_square",
    "notme_village", "notyou_village", "negative_square",
    "areyou_village", "ishe_village", "question_square",
    "possessive_village_1", "possessive_village_2", "possessive_square",
    "twofold_market_1", "twofold_market_2", "twofold_square",
    "daily_grove_1", "daily_grove_2", "daily_square",
    "nevergreen_grove_1", "nevergreen_grove_2", "nevergreen_square",
    "doyou_grove", "doeshe_grove", "doesit_square",
    "thereis_grove_1", "thereis_grove_2", "thereis_square",
    "color_grove_1", "color_grove_2", "color_square",
    "animal_grove_1", "animal_grove_2", "animal_square",
    "family_grove_1", "family_grove_2", "family_square",
    "number_grove_1", "number_grove_2", "number_square",
    "food_grove_1", "food_grove_2", "food_square",
    "body_grove_1", "body_grove_2", "body_square",
    "house_grove_1", "house_grove_2", "house_square",
    "prep_grove_1", "prep_grove_2", "prep_square",
    "ing_grove_1", "ing_grove_2", "ing_square",
]

results = []
for scene in ALL_DIALOGUE_SCENES:
    status, cfg = call("GET", f"/maps/config?scene_key={scene}", token=TOKEN)
    if status != 200:
        print(f"[WARN] {scene}: {status}")
        continue
    data = json.loads(cfg["walls_json"])
    signs = [f for f in data.get("furniture", []) if f.get("minigameType") == "read"]
    if len(signs) != 1:
        continue
    sign = signs[0]
    forest = data.get("forest", [])
    overlap = [f for f in forest if f["x"] == sign["x"] and f["y"] == sign["y"]]
    if not overlap:
        print(f"[skip] {scene}: sin overlap")
        continue
    print(f"{scene}: quitando forest '{overlap[0]['frame']}' en ({sign['x']},{sign['y']})")
    results.append((scene, data, sign))

print(f"\n{len(results)} mapas a corregir\n")

if not DRY_RUN:
    status, allMaps = call("GET", "/admin/maps", token=TOKEN)
    byScene = {m["scene_key"]: m for m in allMaps}
    for scene, data, sign in results:
        data["forest"] = [f for f in data["forest"] if not (f["x"] == sign["x"] and f["y"] == sign["y"])]
        mapId = byScene[scene]["id"]
        body = {"walls_json": json.dumps(data)}
        must("PUT", f"/admin/maps/{mapId}", body, TOKEN, f"remove forest overlap on {scene}")
    print(f"[ok] {len(results)} mapas corregidos.")
