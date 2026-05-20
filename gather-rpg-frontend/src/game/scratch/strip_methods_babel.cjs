const fs = require('fs');
const babel = require('@babel/core');

const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
const content = fs.readFileSync(file, 'utf8');

const methodsToRemove = new Set([
  'adjustZoom',
  'setZoom',
  'configureCamera',
  'createMap',
  '_getTextureForType',
  '_getGroupForType',
  '_findTileAt',
  '_findAllTilesAt',
  '_placeTileDirect',
  '_setupForestSprite',
  '_setupBuildSprite',
  '_setupFurnitureSprite',
  'exportMapConfig',
  'importMapConfig',
  'clearMap',
  'loadMapConfig',
  'resizeMap',
  'calculateMapLimits',
  'updateCameraBounds',
  'processSyncInteractions',
  'handlePickupItem',
  'checkInteractions',
  'triggerInteraction'
]);

const plugin = function ({ types: t }) {
  return {
    visitor: {
      ClassMethod(path) {
        if (t.isIdentifier(path.node.key) && methodsToRemove.has(path.node.key.name)) {
          path.remove();
        }
      }
    }
  };
};

try {
  const result = babel.transformSync(content, {
    filename: file,
    plugins: [
      '@babel/plugin-syntax-jsx',
      plugin
    ],
    retainLines: false 
  });

  let finalCode = result.code;
  
  const proxies = `
  _getTextureForType(type) { return this.mapManager._getTextureForType(type); }
  _getGroupForType(type) { return this.mapManager._getGroupForType(type); }
  _findTileAt(gx, gy, targetType = null) { return this.mapManager._findTileAt(gx, gy, targetType); }
  _findAllTilesAt(gx, gy) { return this.mapManager._findAllTilesAt(gx, gy); }
  _placeTileDirect(type, gx, gy, frame = null, metadata = null) { this.mapManager._placeTileDirect(type, gx, gy, frame, metadata); }
  `;
  
  finalCode = finalCode.replace(/class LobbyScene extends Phaser\.Scene \{/, "class LobbyScene extends Phaser.Scene {\n" + proxies);

  fs.writeFileSync(file, finalCode);
  console.log('Methods successfully stripped using AST.');
} catch (e) {
  console.error("Babel transform failed:", e);
}
