import * as Phaser from 'phaser';

export class NPCSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, charId, username) {
    super(scene, x, y);
    this.scene = scene;
    
    // NORMALIZE ID: If it comes as 'sprite2' or '2', we want just '2'
    // to match the keys in NPCConfig.js and the loaded assets.
    this.npcId = String(charId || '1').replace('sprite', '');
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
    this.playAnimation('idle-waiting');
  }

  playAnimation(animName) {
    // Alias mapping to support common short names
    const aliases = {
        'idle': 'idle-waiting',
        'walk': 'walking'
    };
    const realName = aliases[animName] || animName;

    // Si no empieza por 'npc-', le añadimos el prefijo del ID
    let key = realName.startsWith('npc-') ? realName : `npc-${this.npcId}-${realName}`;
    
    // Fallback: si la animación no existe, intentamos con la 'idle-waiting' básica
    if (!this.scene.anims.exists(key)) {
        if (this.currentAnim === `npc-${this.npcId}-idle-waiting`) return;
        key = `npc-${this.npcId}-idle-waiting`;
    }

    // Final safety check before playing
    const anim = this.scene.anims.get(key);
    if (anim && anim.frames && anim.frames.length > 0) {
      if (this.currentAnim === key && this.sprite.anims.isPlaying) return;
      this.sprite.play(key, true);
      this.currentAnim = key;
    } else {
      console.warn(`[NPCSprite] Animation ${key} is invalid or has no frames.`);
      // If we can't play, at least try to set a static frame if possible
      const texture = this.scene.textures.get(this.sprite.texture.key);
      if (texture && texture.has('idle')) {
          this.sprite.setFrame('idle');
      }
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
