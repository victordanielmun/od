// Renders comic-style speech bubbles above player / NPC sprites and routes
// incoming chat, emoji and NPC-speech events to the right sprite.
export class ChatBubbleManager {
  constructor(scene) {
    this.scene = scene;
  }

  // Resolve the sprite for a player id: the local player or a remote one.
  _resolvePlayerSprite(id) {
    const scene = this.scene;
    if (String(id) === String(scene.myPlayerId)) return scene.player;
    return scene.playerSprites.get(String(id));
  }

  handleChat(e) {
    const { senderId, text } = e.detail;
    const target = this._resolvePlayerSprite(senderId);
    if (target) this.showChatBubble(target, text);
  }

  handleEmoji(e) {
    const { user_id, emoji_id } = e.detail;
    const target = this._resolvePlayerSprite(user_id);
    if (target) target.showEmojiBubble(emoji_id);
  }

  handleNPCSpeech(e) {
    const { templateId, text } = e.detail;
    const target = this.scene.npcSprites.get(templateId);
    if (target) this.showChatBubble(target, text);
  }

  showChatBubble(sprite, text) {
    const scene = this.scene;

    // 1. Cleanup existing bubble for this sprite if any
    if (sprite.chatBubble) {
      sprite.chatBubble.destroy();
    }

    // 2. Create Container
    const container = scene.add.container(sprite.x, sprite.y - 60);
    container.setDepth(9999); // Topmost

    // 3. Text
    const style = {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#000000',
      align: 'center',
      wordWrap: { width: 150 }
    };
    const textObj = scene.add.text(0, 0, text, style);
    textObj.setOrigin(0.5);

    // 4. Background (Comic Bubble)
    const bounds = textObj.getBounds();
    const padding = 10;
    const w = bounds.width + padding * 2;
    const h = bounds.height + padding * 2;

    const bg = scene.add.graphics();
    bg.fillStyle(0xFFFFFF, 1);
    bg.lineStyle(2, 0x000000, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    // Triangle tail
    bg.fillTriangle(-5, h / 2, 5, h / 2, 0, h / 2 + 8);
    bg.strokeTriangle(-5, h / 2, 5, h / 2, 0, h / 2 + 8);

    container.add(bg);
    container.add(textObj);

    // 5. Attach to sprite for tracking
    sprite.chatBubble = container;

    // 6. Tween pop in
    container.setScale(0);
    scene.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.out'
    });

    // 7. Auto Destroy
    scene.time.delayedCall(5000, () => {
      if (container.active) {
        scene.tweens.add({
          targets: container,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            container.destroy();
            sprite.chatBubble = null;
          }
        });
      }
    });
  }
}
