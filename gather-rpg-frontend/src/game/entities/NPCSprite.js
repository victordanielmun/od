import * as Phaser from 'phaser';

export class NPCSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, charId, username) {
    super(scene, x, y);
    this.scene = scene;
    
    // NORMALIZE ID: If it comes as 'sprite2' or '2', we want just '2'
    // to match the keys in NPCConfig.js and the loaded assets.
    this.npcId = String(charId || '2').replace('sprite', '');
    this.username = username;

    // Usamos el ID normalizado para cargar la textura de cuerpo
    const textureKey = `npc-${this.npcId}-body`;
    
    // Fallback: Si no existe, usamos tile-npc (cuadrado azul)
    const initialTexture = scene.textures.exists(textureKey) ? textureKey : 'tile-npc';
    
    this.sprite = scene.add.sprite(0, 0, initialTexture);
    this.sprite.setOrigin(0.5, 0.85);
    // Escala ajustada para que coincida con el tamaño del jugador
    this.sprite.setScale(1.0);

    // Etiqueta de nombre - Estilo Premium para NPCs (Oro/Amarillo)
    this.nameTag = scene.add.text(0, 18, username, {
      fontSize: '15px',
      fill: '#FFE600',
      stroke: '#000000',
      strokeThickness: 6,
      fontFamily: '"Outfit", sans-serif',
      fontWeight: '900'
    }).setOrigin(0.5);
    
    // Add shadow for better contrast
    this.nameTag.setShadow(2, 2, 'rgba(0,0,0,0.8)', 2);

    this.add([this.sprite, this.nameTag]);
    
    // Animación inicial
    this.playAnimation('body-idle');
  }

  playAnimation(animName) {
    // Si no empieza por 'npc-', le añadimos el prefijo del ID
    let key = animName.startsWith('npc-') ? animName : `npc-${this.npcId}-${animName}`;
    
    // Fallback: si la animación no existe, intentamos con la 'body-idle' básica
    if (!this.scene.anims.exists(key)) {
        console.warn(`[NPCSprite] Animación no encontrada: ${key}. Usando fallback idle.`);
        key = `npc-${this.npcId}-body-idle`;
    }

    if (this.scene.anims.exists(key)) {
      if (this.currentAnim === key && this.sprite.anims.isPlaying) return;
      this.sprite.play(key, true);
      this.currentAnim = key;
    }
  }

  setFacing(direction) {
    if (direction === 'left') {
        this.sprite.setFlipX(true);
    } else if (direction === 'right') {
        this.sprite.setFlipX(false);
    }
  }

  preUpdate(time, delta) {
    // Dynamic Y-sorting: Base at character feet
    this.setDepth(this.y + 0.1);
  }
}
