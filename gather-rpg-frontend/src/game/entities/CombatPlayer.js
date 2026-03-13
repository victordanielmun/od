import * as Phaser from 'phaser';


export class CombatPlayer extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.scene = scene;
    this.scene.add.existing(this);

    // Sprite placeholder
    this.sprite = this.scene.add.circle(0, 0, 30, 0x0000ff);
    this.add(this.sprite);

    this.nameText = this.scene.add.text(0, 40, 'Player', { fontSize: '16px', fill: '#fff' }).setOrigin(0.5);
    this.add(this.nameText);
  }

  playAttackAnimation() {
    this.scene.tweens.add({
      targets: this,
      x: this.x + 50,
      duration: 100,
      yoyo: true
    });
  }

  playHitAnimation() {
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 3
    });
  }
}
