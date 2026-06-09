with open(r"c:\Users\USUARIO\Desktop\mis proyectos\-Odyssey-main\gather-rpg-frontend\src\game\map\MapManager.js", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
for i, line in enumerate(lines):
    if "depth" in line.lower() or "layer" in line.lower():
        print(f"Line {i+1}: {line.strip()}")
