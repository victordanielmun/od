import * as Phaser from 'phaser';

export class NPCSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, charId, username, textureType = 'npc') {
    super(scene, x, y);
    this.scene = scene;
    
    // NORMALIZE ID: If it comes as 'sprite2' or '2', we want just '2'
    // to match the keys in NPCConfig.js and the loaded assets.
    this.npcId = String(charId || '1').replace('sprite', '');
    this.username = username;
    this.textureType = textureType;

    // Usamos el ID normalizado para cargar la textura de cuerpo del tipo especificado
    let textureKey = `${this.textureType}-${this.npcId}-body`;
    
    // Fallback: Si no existe la textura específica, intentamos con el ID 1 de ese tipo, o tile-npc
    if (!scene.textures.exists(textureKey)) {
        const fallbackKey = `${this.textureType}-1-body`;
        if (scene.textures.exists(fallbackKey)) {
            textureKey = fallbackKey;
        } else {
            textureKey = 'tile-npc';
        }
    }
    
    this.sprite = scene.add.sprite(0, 0, textureKey);
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

    // Si no empieza por el prefijo, le añadimos el prefijo del ID
    const prefix = `${this.textureType}-`;
    let key = realName.startsWith(prefix) ? realName : `${this.textureType}-${this.npcId}-${realName}`;
    
    // Fallback: si la animación no existe, intentamos con la 'idle-waiting' (o 'idle') básica
    if (!this.scene.anims.exists(key)) {
        const fallbackIdle = `${this.textureType}-${this.npcId}-idle-waiting`;
        const fallbackIdle2 = `${this.textureType}-${this.npcId}-idle`;
        const fallbackDefaultIdle = `${this.textureType}-1-idle-waiting`;
        
        if (this.scene.anims.exists(fallbackIdle)) {
            key = fallbackIdle;
        } else if (this.scene.anims.exists(fallbackIdle2)) {
            key = fallbackIdle2;
        } else if (this.scene.anims.exists(fallbackDefaultIdle)) {
            key = fallbackDefaultIdle;
        }
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
    // Mirror left/right like the player. Any other value (e.g. the legacy
    // 'south' default) falls back to facing right for a consistent look.
    this.sprite.setFlipX(direction === 'left');
  }

  preUpdate(time, delta) {
    // Dynamic Y-sorting: Base at character feet
    this.setDepth(this.y + 0.1);
  }
}
