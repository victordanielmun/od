import json
import sys
from PIL import Image, ImageDraw

FRONTEND_PUBLIC = r"c:\Users\USUARIO\Desktop\mis proyectos\-Odyssey-main\gather-rpg-frontend\public"

def load_atlas(name, png, jsn):
    img = Image.open(f"{FRONTEND_PUBLIC}/{png}").convert("RGBA")
    data = json.load(open(f"{FRONTEND_PUBLIC}/{jsn}"))
    frames = {f["filename"]: f["frame"] for f in data["frames"]}
    return img, frames

terrain_img, terrain_frames = load_atlas("terrain", "terrain/terrain-spritesheet.png", "terrain/terrain-sprites.json")
forest_img, forest_frames = load_atlas("forest", "forest/forest-spritesheet.png", "forest/forest-sprites.json")

def crop(img, frames, name):
    f = frames.get(name)
    if not f:
        return None
    return img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))

def render(map_json_path, out_path):
    data = json.load(open(map_json_path))
    w, h = data["width"], data["height"]
    canvas = Image.new("RGBA", (w, h), (20, 20, 20, 255))

    for t in data.get("floors", []):
        sp = crop(terrain_img, terrain_frames, t["frame"])
        if sp:
            sp = sp.resize((100, 100), Image.NEAREST)
            canvas.paste(sp, (t["x"] - 50, t["y"] - 50), sp)

    for t in data.get("forest", []):
        sp = crop(forest_img, forest_frames, t["frame"])
        if sp:
            scale = min(96 / sp.width, 96 / sp.height)
            sp = sp.resize((int(sp.width * scale), int(sp.height * scale)), Image.NEAREST)
            canvas.paste(sp, (t["x"] - sp.width // 2, t["y"] - sp.height + 20), sp)

    draw = ImageDraw.Draw(canvas)
    for t in data.get("voids", []):
        draw.rectangle([t["x"] - 50, t["y"] - 50, t["x"] + 50, t["y"] + 50], outline=(37, 150, 190, 255), width=3)

    for e in data.get("enemySpawns", []):
        draw.ellipse([e["x"] - 15, e["y"] - 15, e["x"] + 15, e["y"] + 15], fill=(255, 0, 0, 220))
        draw.text((e["x"] - 8, e["y"] - 8), str(e.get("waveNum", "?")), fill=(255, 255, 255, 255))

    for p in data.get("pickups", []):
        draw.ellipse([p["x"] - 10, p["y"] - 10, p["x"] + 10, p["y"] + 10], fill=(255, 20, 147, 220))

    for n in data.get("npcZones", []):
        draw.ellipse([n["x"] - 20, n["y"] - 20, n["x"] + 20, n["y"] + 20], outline=(68, 136, 255, 255), width=4)
        draw.text((n["x"] - 10, n["y"] - 8), "N", fill=(68, 136, 255, 255))

    for key in ("furniture", "furniture2", "furniture3"):
        for s in data.get(key, []):
            draw.ellipse([s["x"] - 14, s["y"] - 14, s["x"] + 14, s["y"] + 14], outline=(255, 215, 0, 255), width=3)

    for b in data.get("builds", []):
        draw.rectangle([b["x"] - 60, b["y"] - 60, b["x"] + 60, b["y"] + 60], outline=(200, 120, 40, 255), width=4)

    canvas.save(out_path)
    print(f"saved {out_path} ({w}x{h})")

if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])
