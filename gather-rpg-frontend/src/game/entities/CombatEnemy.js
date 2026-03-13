import * as Phaser from 'phaser';


export class CombatEnemy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, name) {
    super(scene, x, y);
    this.scene = scene;
    this.scene.add.existing(this);

    // Sprite placeholder
    this.sprite = this.scene.add.circle(0, 0, 30, 0xff0000);
    this.add(this.sprite);

    this.nameText = this.scene.add.text(0, 40, name, { fontSize: '16px', fill: '#fff' }).setOrigin(0.5);
    this.add(this.nameText);
  }

  playAttackAnimation() {
    this.scene.tweens.add({
      targets: this,
      x: this.x - 50,
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
