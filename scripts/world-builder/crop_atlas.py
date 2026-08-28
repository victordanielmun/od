import json
import sys
from PIL import Image, ImageDraw, ImageFont

def build_sheet(png_path, json_path, out_path, cols=10, cell=140, pad=6):
    img = Image.open(png_path).convert("RGBA")
    data = json.load(open(json_path))
    frames = data["frames"]
    n = len(frames)
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (30, 30, 30, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()

    for i, fr in enumerate(frames):
        name = fr["filename"]
        f = fr["frame"]
        crop = img.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        # scale to fit within cell - pad, preserving aspect
        maxw = maxh = cell - pad * 2 - 16
        scale = min(maxw / crop.width, maxh / crop.height, 1.0) if crop.width and crop.height else 1
        if scale < 1.0:
            crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.NEAREST)
        col = i % cols
        row = i // cols
        cx = col * cell + cell // 2
        cy = row * cell + (cell - 16) // 2
        sheet.paste(crop, (cx - crop.width // 2, cy - crop.height // 2), crop)
        draw.text((col * cell + 4, row * cell + cell - 16), name, fill=(255, 255, 0, 255), font=font)
        draw.rectangle([col * cell, row * cell, col * cell + cell - 1, row * cell + cell - 1], outline=(80, 80, 80, 255))

    sheet.save(out_path)
    print(f"saved {out_path} ({n} frames, {cols}x{rows} grid)")

if __name__ == "__main__":
    png, jsn, out = sys.argv[1], sys.argv[2], sys.argv[3]
    build_sheet(png, jsn, out)
