import * as Phaser from 'phaser';

import { CombatPlayer } from '../entities/CombatPlayer';
import { CombatEnemy } from '../entities/CombatEnemy';
import { useCombatStore } from '../../store/combatStore';
import wsClient from '../../services/websocket';

export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.combatState = null;
  }

  init(data) {
    this.enemyId = data.enemyId;
    this.enemySprite = data.enemySprite;
  }

  create() {
    // Background
    this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);

    // Initial positions
    this.playerCombat = new CombatPlayer(this, 200, 400);
    this.enemyCombat = null; // Created when combat_started received

    // Setup WebSocket listeners
    this.onCombatStarted = this.handleCombatStarted.bind(this);
    this.onTurnResult = this.handleTurnResult.bind(this);
    this.onCombatEnded = this.handleCombatEnded.bind(this);

    wsClient.on('combat_started', this.onCombatStarted);
    wsClient.on('turn_result', this.onTurnResult);
    wsClient.on('combat_ended', this.onCombatEnded);
  }

  handleCombatStarted(data) {
    this.combatState = data;

    // Create Enemy Visual
    this.enemyCombat = new CombatEnemy(
      this,
      600,
      400,
      data.enemy.name || 'Enemy'
    );

    // Update React Store
    useCombatStore.getState().startCombat(data);
  }

  handleTurnResult(data) {
    // Animate actions
    data.actions.forEach((action, index) => {
      this.time.delayedCall(index * 1000, () => {
        this.animateAction(action);
      });
    });

    const totalDelay = data.actions.length * 1000;
    this.time.delayedCall(totalDelay, () => {
      useCombatStore.getState().updateCombatState(data);
    });
  }

  animateAction(action) {
    if (action.actor === 'player') {
      this.playerCombat.playAttackAnimation();

      this.time.delayedCall(300, () => {
        if (this.enemyCombat) {
          this.showDamageNumber(this.enemyCombat.x, this.enemyCombat.y, action.damage);
          this.enemyCombat.playHitAnimation();
        }
      });
    } else {
      if (this.enemyCombat) {
        this.enemyCombat.playAttackAnimation();
      }

      this.time.delayedCall(300, () => {
        this.showDamageNumber(this.playerCombat.x, this.playerCombat.y, action.damage);
        this.playerCombat.playHitAnimation();
      });
    }
  }

  showDamageNumber(x, y, damage) {
    const damageText = this.add.text(x, y, `-${damage}`, {
      fontSize: '24px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: damageText,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => damageText.destroy()
    });
  }

  handleCombatEnded(data) {
    // Clean listeners
    wsClient.off('combat_started', this.onCombatStarted);
    wsClient.off('turn_result', this.onTurnResult);
    wsClient.off('combat_ended', this.onCombatEnded);

    useCombatStore.getState().endCombat(data);

    this.time.delayedCall(3000, () => {
      this.scene.stop('CombatScene');
      this.scene.resume('MainScene'); // Use MainScene instead of GameScene

      if (data.result === 'victory') {
        if (this.enemySprite && this.enemySprite.destroy) {
          this.enemySprite.destroy();
        }
      } else {
        if (this.enemySprite) {
          this.enemySprite.setVisible(true);
          // Re-enable body if needed
          if (this.enemySprite.body) {
            this.enemySprite.enableBody(true, this.enemySprite.x, this.enemySprite.y, true, true);
          }
        }
      }

      useCombatStore.getState().closeCombat();
    });
  }
}
