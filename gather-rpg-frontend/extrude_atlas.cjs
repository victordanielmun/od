const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Uso: node extrude_atlas.js <ruta_al_json_del_atlas>");
  process.exit(1);
}

const jsonPath = path.resolve(args[0]);
if (!fs.existsSync(jsonPath)) {
  console.error("Archivo no encontrado:", jsonPath);
  process.exit(1);
}

const dir = path.dirname(jsonPath);
const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

if (!atlas.meta || !atlas.meta.image) {
  console.error("El JSON no tiene la propiedad meta.image válida para un atlas.");
  process.exit(1);
}

let imagePath = path.resolve(dir, atlas.meta.image);
if (!fs.existsSync(imagePath)) {
  const base = path.basename(jsonPath, '.json');
  const possiblePaths = [
    path.join(dir, `${base}.png`),
    path.join(dir, `${base.replace('-sprites', '-spritesheet')}.png`),
    path.join(dir, `spritesheet.png`)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      imagePath = p;
      break;
    }
  }
}

if (!fs.existsSync(imagePath)) {
  console.error("Imagen no encontrada para el atlas:", jsonPath, " (Buscó:", atlas.meta.image, " y alternativos)");
  process.exit(1);
}

// Extrusion settings
const EXTRUDE = 1; // 1 pixel extrude

async function run() {
  console.log(`Cargando imagen: ${imagePath}`);
  const img = await Jimp.read(imagePath);
  
  const frames = Array.isArray(atlas.frames) ? atlas.frames : Object.values(atlas.frames);
  if (frames.length === 0) {
    console.log("No hay frames para extruir.");
    return;
  }

  // Calculate new image size.
  // Assuming a grid-like placement or just finding the max extents after adding margins.
  let maxX = 0;
  let maxY = 0;

  // We will re-layout them in a simple row-wrap manner, or preserve relative grid?
  // It's safest to preserve their grid layout if they are on a grid.
  // Actually, we can just rebuild a new image from scratch tightly packed or just laid out exactly the same but expanded.
  // Let's lay them out exactly the same but expanded.
  // For each frame, it gets +EXTRUDE on all 4 sides. 
  // If frame A is at x=100, and is the 2nd column (index 1), its new X will be 100 + (1 * 2 * EXTRUDE) + EXTRUDE.
  
  // Since we don't strictly know if it's a perfect grid, we can just re-pack them horizontally/vertically,
  // OR we can deduce the grid cell size from the first frame.
  const firstFrame = frames[0].frame;
  const tileW = firstFrame.w;
  const tileH = firstFrame.h;
  
  let cols = 0;
  let rows = 0;
  for (const f of frames) {
    const col = Math.round(f.frame.x / tileW);
    const row = Math.round(f.frame.y / tileH);
    if (col + 1 > cols) cols = col + 1;
    if (row + 1 > rows) rows = row + 1;
  }
  
  const newTileW = tileW + (EXTRUDE * 2);
  const newTileH = tileH + (EXTRUDE * 2);
  
  const newImgW = cols * newTileW;
  const newImgH = rows * newTileH;
  
  console.log(`Grid detectado: ${cols}x${rows}. Nuevo tamaño de imagen: ${newImgW}x${newImgH}`);
  const outImg = new Jimp(newImgW, newImgH, 0x00000000); // Transparent
  
  const newAtlas = JSON.parse(JSON.stringify(atlas)); // clone
  const newFrames = Array.isArray(newAtlas.frames) ? newAtlas.frames : Object.values(newAtlas.frames);

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const col = Math.round(f.frame.x / tileW);
    const row = Math.round(f.frame.y / tileH);
    
    const dstX = col * newTileW;
    const dstY = row * newTileH;
    
    // Copy the original tile into the center of the new slot
    const innerDstX = dstX + EXTRUDE;
    const innerDstY = dstY + EXTRUDE;
    
    outImg.blit(img, innerDstX, innerDstY, f.frame.x, f.frame.y, tileW, tileH);
    
    // Top border
    outImg.blit(img, innerDstX, dstY, f.frame.x, f.frame.y, tileW, 1);
    // Bottom border
    outImg.blit(img, innerDstX, innerDstY + tileH, f.frame.x, f.frame.y + tileH - 1, tileW, 1);
    // Left border
    outImg.blit(img, dstX, innerDstY, f.frame.x, f.frame.y, 1, tileH);
    // Right border
    outImg.blit(img, innerDstX + tileW, innerDstY, f.frame.x + tileW - 1, f.frame.y, 1, tileH);
    
    // Corners
    outImg.blit(img, dstX, dstY, f.frame.x, f.frame.y, 1, 1); // TL
    outImg.blit(img, innerDstX + tileW, dstY, f.frame.x + tileW - 1, f.frame.y, 1, 1); // TR
    outImg.blit(img, dstX, innerDstY + tileH, f.frame.x, f.frame.y + tileH - 1, 1, 1); // BL
    outImg.blit(img, innerDstX + tileW, innerDstY + tileH, f.frame.x + tileW - 1, f.frame.y + tileH - 1, 1, 1); // BR

    // Update JSON
    newFrames[i].frame.x = innerDstX;
    newFrames[i].frame.y = innerDstY;
    // w and h remain the same because Phaser expects the UN-extruded dimensions for drawing
  }

  // Save new image
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext);
  const newImagePath = path.join(dir, `${baseName}_extruido${ext}`);
  
  await outImg.writeAsync(newImagePath);
  console.log(`Imagen extruida guardada en: ${newImagePath}`);
  
  // Save new JSON
  newAtlas.meta.image = path.basename(newImagePath);
  newAtlas.meta.size = { w: newImgW, h: newImgH };
  
  const baseJsonName = path.basename(jsonPath, '.json');
  const newJsonPath = path.join(dir, `${baseJsonName}_extruido.json`);
  fs.writeFileSync(newJsonPath, JSON.stringify(newAtlas, null, 2), 'utf8');
  console.log(`JSON extruido guardado en: ${newJsonPath}`);
  
  console.log("¡Proceso completado! Actualiza el path en tus scripts de Phaser para usar los archivos _extruido.");
}

run().catch(console.error);
