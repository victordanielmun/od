import * as Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../config/CharacterConfig';

export class PlayerSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, characterId, frame, username, isSelf = false) {
    super(scene, x, y);

    this.scene = scene;
    this.username = username;
    this.isSelf = isSelf;

    // Store character ID (e.g. '1', '2') instead of texture key
    this.characterId = characterId || '1';

    // Default to base texture for initial render
    const initialTexture = `char-${this.characterId}-base`;

    this.sprite = scene.add.sprite(0, 0, initialTexture, frame);
    // Scale down if the sprite is huge (544x325 is massive for a web game)
    // We import config to check scale if needed, or assume caller handled texture key
    // For now keeping hardcoded fallback or read from config if we imported it.
    // Ideally pass scale in constructor or read global config.
    this.sprite.setOrigin(0.5, 0.85); // Anchor at feet (adjusted for larger sprite)
    
    // Read character-specific scale dynamically from frame texture
    this.normalizeScale();

    // Add name tag - Unified style with NPCs but with white color
    this.nameTag = scene.add.text(0, 18, username, {
      fontSize: '14px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 'bold'
    }).setOrigin(0.5);

    this.add([this.sprite, this.nameTag]);

    // Physics: Add bodies for everyone to enable collision.
    scene.physics.add.existing(this);
    this.body.setCircle(25, -25, -25); // Consistent hitbox
    
    if (this.isSelf) {
      this.body.setCollideWorldBounds(true);
    } else {
      // Remote players should be solid but immovable by the local player
      this.body.setImmovable(true);
    }

    this.currentAnim = `char-${this.characterId}-idle`;
    this.playAnimation(this.currentAnim);
  }

  playAnimation(key, lockDuration = 0) {
    // If we are currently locked by a previous animation, don't play a new one
    if (this._animLocked && this.scene.time.now < this._animLockTime) {
      // Allow overriding a lock if we are dying or taking hurt
      const isOverride = key === 'die' || key === 'dead' || key === 'hurt' ||
                         key.endsWith('-die') || key.endsWith('-dead') || key.endsWith('-hurt');
      if (!isOverride) {
        return;
      }
    }

    // Alias: 'dead' → 'die' (PlayerController uses 'dead'; generated file uses 'die')
    if (key === 'dead') key = 'die';

    // If key is just 'walk' or 'slash', prepend character ID
    if (!key.startsWith('char-')) {
      key = `char-${this.characterId}-${key}`;
    }

    // Ensure key exists
    if (!this.scene.anims.exists(key)) {
      // console.warn(`Animation ${key} missing`);
      return;
    }
    if (this.currentAnim === key && this.sprite.anims.isPlaying) return;
    
    // Low-level animation log (disabled by default to avoid spam)
    // console.log(`[PlayerSprite] ${this.username} (ID: ${this.characterId}) playing animation: ${key}`);
    
    this.sprite.play(key, true);
    this.currentAnim = key;

    // Apply animation lock if requested
    if (lockDuration > 0) {
      this._animLocked = true;
      this._animLockTime = this.scene.time.now + lockDuration;
    } else if (key === `char-${this.characterId}-idle` || key === `char-${this.characterId}-walk`) {
      // Re-enable if we explicitly go back to idle/walk and no duration is passed
      this._animLocked = false;
    }
  }

  updateMovement(velocity) {
    // 1. Flip based on X direction
    if (velocity.x < 0) {
      this.sprite.setFlipX(true);
    } else if (velocity.x > 0) {
      this.sprite.setFlipX(false);
    }

    // 2. Play animation
    const suffix = (velocity.length() > 0) ? 'walk' : 'idle';
    this.playAnimation(suffix); // Will become char-{id}-walk

    // 3. Depth sorting: add small bias (+0.1) to ensure players 
    // are drawn over map objects at the exact same Y-level.
    this.setDepth(this.y + 0.1);
  }

  setDisplayName(name) {
    this.nameTag.setText(name);
  }

  updateSpriteTexture(newCharacterId) {
    if (!newCharacterId || this.characterId === newCharacterId) return;

    this.characterId = newCharacterId;
    const newTexture = `char-${newCharacterId}-base`;
    
    if (this.scene.textures.exists(newTexture)) {
        console.log(`[PlayerSprite] ${this.username} updating texture to ${newTexture}`);
        this.sprite.setTexture(newTexture);
        
        // Update scale factor dynamically
        this.normalizeScale();

        this.playAnimation('idle'); // Force restart animation with new ID
    } else {
        console.warn(`[PlayerSprite] Texture ${newTexture} not found when updating character sync.`);
    }
  }

  normalizeScale() {
    if (!this.sprite || !this.sprite.texture) return;
    const tex = this.sprite.texture;
    
    // Obtenemos los nombres de los frames en el atlas
    const frameNames = tex.getFrameNames();
    let h = 0;
    
    if (frameNames && frameNames.length > 0) {
      // Intentamos usar un frame de reposo/idle representativo para calcular la escala
      const repName = frameNames.find(name => 
        name.includes('frame_000') || 
        name.includes('sprite3') || 
        name.includes('idle')
      ) || frameNames[0];
      
      const frame = tex.get(repName);
      h = frame?.height || 0;
    }
    
    if (h === 0) {
      h = this.sprite.height;
    }
    
    if (h > 0) {
      const targetHeight = CHARACTER_CONFIG.base.targetHeight || 108;
      const computedScale = targetHeight / h;
      this.sprite.setScale(computedScale);
    }
  }

  showEmojiBubble(emojiId) {
    // 1. Cleanup existing emoji if any
    if (this.emojiBubble) {
      this.emojiBubble.destroy();
    }

    // 2. Create Container for the bubble
    // Position it above the name tag (nameTag is at -110)
    const container = this.scene.add.container(this.x, this.y - 160);
    container.setDepth(10000);

    // 3. Background (Rounded Bubble)
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xFFFFFF, 1);
    bg.lineStyle(3, 0x4488FF, 1);
    bg.fillRoundedRect(-30, -30, 60, 60, 12);
    bg.strokeRoundedRect(-30, -30, 60, 60, 12);
    
    // Triangle tail
    bg.fillTriangle(-6, 30, 6, 30, 0, 38);
    bg.strokeTriangle(-6, 30, 6, 30, 0, 38);

    // 4. Portrait Sprite
    // Portraits are at /characters/{id}c.png
    // We need to ensure these are loaded in the scene. 
    // Usually these are 64x64 or similar.
    const portraitKey = `portrait-${emojiId}`;
    let portrait;
    
    if (this.scene.textures.exists(portraitKey)) {
        portrait = this.scene.add.image(0, 0, portraitKey);
        portrait.setDisplaySize(50, 50);
    } else {
        // Fallback or dynamically load? 
        // For now assume LobbyScene preloads all char portraits.
        // If not, we could show a placeholder or load on demand.
        this.scene.load.image(portraitKey, `/characters/${emojiId.replace('c', '')}c.png`);
        this.scene.load.once('complete', () => {
            if (container.active) {
                const img = this.scene.add.image(0, 0, portraitKey);
                img.setDisplaySize(50, 50);
                container.add(img);
            }
        });
        this.scene.load.start();
    }

    container.add(bg);
    if (portrait) container.add(portrait);

    this.emojiBubble = container;

    // 5. Pop Animation
    container.setScale(0);
    this.scene.tweens.add({
      targets: container,
      scale: 1,
      duration: 300,
      ease: 'Back.out'
    });

    // 6. Floating movement during display
    this.scene.tweens.add({
      targets: container,
      y: container.y - 10,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 7. Auto Destroy
    this.scene.time.delayedCall(4000, () => {
      if (container.active) {
        this.scene.tweens.add({
          targets: container,
          alpha: 0,
          scale: 0.5,
          duration: 300,
          onComplete: () => {
            container.destroy();
            this.emojiBubble = null;
          }
        });
      }
    });
  }

  preUpdate(time, delta) {
    // Sync bubbles with player position if they exist
    if (this.emojiBubble) {
        this.emojiBubble.x = this.x;
        // The y position is slightly offset to follow but keep it above
        // The tween handles the relative y movement.
    }
    this.setDepth(this.y + 0.1);
  }
}
