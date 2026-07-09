import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FlaskConical, Flame, Wind, Zap, Package, Play, RotateCcw, ChevronRight, Activity, Sparkles, Swords, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { CHARACTER_CONFIG, loadCharacterSprites, createCharacterAnimations } from '../../game/config/CharacterConfig';

const Phaser = window.Phaser;

// ── Spell visual data (mirrors CombatSystem.js SPELL_PROFILES) ────────────────
const SPELL_PROFILES = {
    fire_rain: { label: 'Fire Rain',  mpCost: 30, color: 0xff4400, flash: 0xff2200, desc: 'Lluvia de bolas de fuego desde arriba' },
    wave:      { label: 'Wave',       mpCost: 25, color: 0x44aaff, flash: 0x4488ff, desc: 'Onda mágica horizontal que barre enemigos' },
    nova:      { label: 'Nova',       mpCost: 40, color: 0xaa44ff, flash: 0xaa44ff, desc: 'Explosión radial desde el jugador' },
};

const THROWABLE_PROFILES = [
    { label: 'Cuchillo',  cssColor: '#c0c0c0', icon: '🗡️',  desc: 'Proyectil recto de daño físico', iconKey: 'sword_wood' },
    { label: 'Bomba',     cssColor: '#ff8800', icon: '💣',  desc: 'Objeto explosivo de área', iconKey: 'bomb' },
    { label: 'Estrella',  cssColor: '#ffcc00', icon: '⭐',  desc: 'Shuriken de alta velocidad', iconKey: 'star' },
    { label: 'Veneno',    cssColor: '#44ff66', icon: '🧪',  desc: 'Proyectil envenenador', iconKey: 'potion_green' },
];

const LOG_COLORS = {
    fire_rain: '#ff6633', wave: '#66aaff', nova: '#cc66ff',
    throw: '#aaaaaa', info: '#888888', hit: '#ffcc00',
    enemy_attack: '#ff3366',
};

// ── Phaser Lab Scene ──────────────────────────────────────────────────────────
class CombatLabScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CombatLabScene', physics: { default: 'arcade' } });
        this.player      = null;
        this.dummies     = [];
        this.addLog      = null; // callback to React
        this.playerCharId = '1';
        this.enemyTimer = null;
    }

    preload() {
        // Load character sheets safely using config helper (avoids non-existent combos)
        loadCharacterSprites(this);
    }

    create() {
        const W = this.scale.width, H = this.scale.height;

        // Floor / grid
        const g = this.add.graphics();
        g.fillStyle(0x0a0a1a, 1);
        g.fillRect(0, 0, W, H);
        g.lineStyle(1, 0x1a1a3a, 0.7);
        for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.strokePath(); }
        for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }

        // Floor shadow line
        const floor = this.add.graphics();
        floor.lineStyle(3, 0x2233aa, 0.6);
        floor.lineBetween(0, H * 0.72, W, H * 0.72);

        // Register player animations dynamically using helper
        createCharacterAnimations(this);
        
        // Generate a fallback round texture for projectiles before assets load
        if (!this.textures.exists('lab-fallback')) {
            const tempG = this.make.graphics({ x: 0, y: 0, add: false });
            tempG.fillStyle(0xffffff, 1);
            tempG.fillCircle(12, 12, 10);
            tempG.generateTexture('lab-fallback', 24, 24);
            tempG.destroy();
        }

        // Training dummies
        this._spawnDummies(W, H);

        // Player character
        this._spawnPlayer(W * 0.15, H * 0.68);

        // HUD
        this._buildHUD(W, H);

        // Group for projectiles (standard group, not physics group to prevent overrides on Shape objects)
        this.projectiles = this.add.group();
        this.physics.add.overlap(this.projectiles, this.dummyGroup, (proj, dummy) => {
            this._onProjectileHit(proj, dummy);
        });

        this._log('info', '🎮 Lab listo — selecciona un ataque');
    }

    _log(type, text) {
        if (this.addLog) this.addLog(type, text);
    }

    _spawnDummies(W, H) {
        const y = H * 0.60;
        const xs = [W * 0.45, W * 0.62, W * 0.79];

        this.dummyGroup = this.physics.add.staticGroup();
        this.dummies = xs.map((x, i) => {
            return this._createDummyAt(x, y, `Dummy ${i + 1}`);
        });
    }

    _createDummyAt(x, y, name, labelColor = '#aa77cc', bodyColor = 0x8855aa) {
        // Body
        const body = this.add.graphics().setDepth(5);
        body.fillStyle(bodyColor, 0.9);
        body.fillCircle(0, 0, 18);
        body.fillStyle(bodyColor - 0x222200, 0.8);
        body.fillRect(-10, 16, 20, 35);
        body.setPosition(x, y);

        // HP bar backing
        const hpBg = this.add.rectangle(x, y - 30, 40, 5, 0x330033).setDepth(6);
        const hpBar = this.add.rectangle(x - 20, y - 30, 40, 5, 0xcc44ff).setOrigin(0, 0.5).setDepth(7);

        // Physics dummy for overlap detection
        const physRect = this.physics.add.staticImage(x, y, null).setDisplaySize(36, 55);
        physRect.body.setSize(36, 55);
        physRect.setAlpha(0);
        physRect.hpBar = hpBar;
        physRect.hpBg = hpBg;
        physRect.hp    = 100;
        physRect.hpMax = 100;
        physRect.label = name;
        physRect.bodyGfx = body;

        const textObj = this.add.text(x, y + 36, name, {
            fontSize: '11px', fill: labelColor, fontFamily: 'Outfit, sans-serif'
        }).setOrigin(0.5).setDepth(6);

        physRect.textLabel = textObj;

        this.dummyGroup.add(physRect);
        return physRect;
    }

    // Spawn a database enemy behavior in dummy position 1
    spawnCustomEnemy(enemyData) {
        if (this.enemyTimer) {
            this.enemyTimer.remove();
            this.enemyTimer = null;
        }

        // Clean up dummy 1 if it exists
        const oldDummy = this.dummies[0];
        if (oldDummy) {
            if (oldDummy.bodyGfx) oldDummy.bodyGfx.destroy();
            if (oldDummy.hpBar) oldDummy.hpBar.destroy();
            if (oldDummy.hpBg) oldDummy.hpBg.destroy();
            if (oldDummy.textLabel) oldDummy.textLabel.destroy();
            this.dummyGroup.remove(oldDummy);
            oldDummy.destroy();
        }

        const W = this.scale.width, H = this.scale.height;
        const x = W * 0.45, y = H * 0.60;

        // Bosses use red, normal enemies use orange
        const isBoss = enemyData.ai_behavior === 'boss';
        const labelColor = isBoss ? '#ff3333' : '#ff9900';
        const bodyColor = isBoss ? 0xcc2222 : 0xdd6622;

        const newEnemy = this._createDummyAt(x, y, enemyData.name, labelColor, bodyColor);
        newEnemy.hp = enemyData.hp_max || 100;
        newEnemy.hpMax = enemyData.hp_max || 100;
        newEnemy.enemyData = enemyData;
        
        // Put it in index 0
        this.dummies[0] = newEnemy;

        this._log('info', `👾 Spawneado: ${enemyData.name} (Modo: ${enemyData.ai_behavior.toUpperCase()})`);

        // Start behavior loop
        const rate = enemyData.attack_rate || 2000;
        this.enemyTimer = this.time.addEvent({
            delay: rate,
            loop: true,
            callback: () => {
                this._simulateEnemyAI(newEnemy);
            }
        });
    }

    _simulateEnemyAI(enemy) {
        if (!enemy || enemy.hp <= 0) return;
        const data = enemy.enemyData;
        if (!data) return;

        // Visual flash showing attack activation
        if (enemy.bodyGfx) {
            enemy.bodyGfx.setAlpha(0.5);
            this.tweens.add({
                targets: enemy.bodyGfx,
                scaleX: 1.15, scaleY: 1.15,
                yoyo: true, duration: 150,
                onComplete: () => {
                    if (enemy.bodyGfx) {
                        enemy.bodyGfx.setAlpha(1);
                        enemy.bodyGfx.setScale(1);
                    }
                }
            });
        }

        const behavior = data.ai_behavior;
        const attackDmg = data.attack || 10;

        if (behavior === 'thrower') {
            // Throw projectile back at player
            this._enemyThrowProjectile(enemy.x, enemy.y, 'Bola de energía', 0xff9900, attackDmg);
            this._log('enemy_attack', `🎯 [${data.name}] lanza proyectil — Daño estimado: ${attackDmg}`);
        } else if (behavior === 'boss') {
            // Boss executes alternate random attacks
            const rand = Phaser.Math.Between(0, 2);
            if (rand === 0) {
                // Boss Nova
                this._log('enemy_attack', `🔮 [Boss: ${data.name}] lanza NOVA AoE de ${attackDmg * 2} Daño!`);
                this._enemyCastNova(enemy.x, enemy.y, 0xff3366);
            } else if (rand === 1) {
                // Boss Rain
                this._log('enemy_attack', `☄️ [Boss: ${data.name}] conjura Lluvia Meteorito de ${attackDmg} Daño!`);
                this._enemyCastRain(enemy.x, enemy.y, 0xff3333);
            } else {
                // Dash
                this._log('enemy_attack', `⚡ [Boss: ${data.name}] realiza Embestida física de ${attackDmg} Daño!`);
                this.tweens.add({
                    targets: enemy.bodyGfx,
                    x: this.playerX + 50,
                    yoyo: true, duration: 250,
                    onUpdate: () => {
                        if (Phaser.Math.Distance.Between(enemy.bodyGfx.x, enemy.y, this.playerX, this.playerY) < 60) {
                            this._screenFlash(0xff3333, 0.15, 100);
                        }
                    }
                });
            }
        } else {
            // Melee / Fast basic slash attack
            this._log('enemy_attack', `⚔️ [${data.name}] ejecuta ataque cuerpo a cuerpo (${attackDmg} daño)`);
            const slash = this.add.rectangle(this.playerX + 40, this.playerY - 10, 10, 45, 0xff3333, 0.8).setDepth(20);
            this.tweens.add({
                targets: slash, scaleX: 4, alpha: 0, duration: 200,
                onComplete: () => slash.destroy()
            });
            this.cameras.main.shake(100, 0.005);
        }
    }

    _enemyThrowProjectile(x, y, name, color, dmg) {
        // Use a sprite with fallback texture and tint so it has a standard sprite body and properties
        const ball = this.add.sprite(x, y - 10, 'lab-fallback').setDepth(45).setTint(color || 0xffaa00).setDisplaySize(16, 16);
        this.physics.add.existing(ball);
        if (ball.body) {
            ball.body.setAllowGravity(false);
            ball.body.setSize(16, 16);
            ball.body.setVelocity(-450, 0);
        }
        
        this.physics.add.overlap(ball, this.player, () => {
            this._spawnHitEffect(this.playerX, this.playerY, 0xff3333);
            this._screenFlash(0xff0000, 0.1, 100);
            ball.destroy();
        });

        this.time.delayedCall(2000, () => { if (ball.active) ball.destroy(); });
    }

    _enemyCastNova(x, y, color) {
        const ring = this.add.graphics().setDepth(25);
        let radius = 10;
        const timer = this.time.addEvent({
            delay: 16, repeat: 25,
            callback: () => {
                ring.clear();
                radius += 6;
                ring.lineStyle(3, color, Math.max(0, 1 - radius / 160));
                ring.strokeCircle(x, y, radius);
                if (Phaser.Math.Distance.Between(x, y, this.playerX, this.playerY) <= radius) {
                    this._spawnHitEffect(this.playerX, this.playerY, color);
                }
            }
        });
        this.time.delayedCall(450, () => { ring.destroy(); timer.remove(); });
    }

    _enemyCastRain(x, y, color) {
        for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 150, () => {
                const rx = this.playerX + Phaser.Math.Between(-80, 80);
                const ball = this.add.circle(rx, y - 250, 8, color, 0.9).setDepth(25);
                this.tweens.add({
                    targets: ball, y: this.playerY, duration: 300,
                    onComplete: () => {
                        this._spawnHitEffect(ball.x, ball.y, color);
                        if (Math.abs(ball.x - this.playerX) < 40) {
                            this._screenFlash(0xff0000, 0.08, 100);
                        }
                        ball.destroy();
                    }
                });
            });
        }
    }

    _spawnPlayer(x, y) {
        const id = this.playerCharId;
        const textureKey = `char-${id}-base`;

        if (this.textures.exists(textureKey)) {
            this.player = this.add.sprite(x, y, textureKey).setOrigin(0.5, 0.85).setScale(1.4).setDepth(10);
            
            // Auto return to idle on animation end
            this.player.on('animationcomplete', (animation) => {
                const completedAnimName = animation.key.replace(`char-${id}-`, '');
                const autoReturnToIdle = ['projectile', 'special', 'potion'];
                if (autoReturnToIdle.includes(completedAnimName)) {
                    this._tryAnim(`char-${id}-idle`, true);
                }
            });

            this._tryAnim(`char-${id}-idle`, true);
        } else {
            // Fallback: draw a placeholder silhouette
            const pg = this.add.graphics().setDepth(10);
            pg.fillStyle(0x4488ff, 0.9);
            pg.fillCircle(0, 0, 16);
            pg.fillStyle(0x3366dd, 0.8);
            pg.fillRect(-10, 14, 20, 36);
            pg.setPosition(x, y);
            this.player = pg;
        }
        this.playerX = x;
        this.playerY = y;

        // Name label
        this.add.text(x, y + 10, '⚔ Personaje', {
            fontSize: '11px', fill: '#88aaff', fontFamily: 'Outfit, sans-serif'
        }).setOrigin(0.5).setDepth(11);
    }

    _tryAnim(key, repeat) {
        if (!this.player || !this.player.anims) return;
        if (this.anims.exists(key)) {
            this.player.play({ key, repeat: repeat ? -1 : 0 });
        }
    }

    _buildHUD(W, H) {
        // MP bar backdrop
        this.add.rectangle(W * 0.5, H - 22, 200, 14, 0x001133, 0.8).setDepth(20).setOrigin(0.5);
        this.mpBarBg = this.add.rectangle(W * 0.5 - 99, H - 22, 198, 10, 0x001155, 0.9).setOrigin(0, 0.5).setDepth(21);
        this.mpBar   = this.add.rectangle(W * 0.5 - 99, H - 22, 198, 10, 0x4488ff, 1).setOrigin(0, 0.5).setDepth(22);
        this.mpLabel = this.add.text(W * 0.5, H - 22, 'MP 100 / 100', {
            fontSize: '10px', fill: '#88ccff', fontFamily: 'Outfit, sans-serif'
        }).setOrigin(0.5).setDepth(23);

        this.labMP    = 100;
        this.labMPMax = 100;
    }

    _updateMPBar() {
        const pct = Math.max(0, this.labMP / this.labMPMax);
        this.mpBar.setDisplaySize(198 * pct, 10);
        this.mpLabel.setText(`MP ${this.labMP} / ${this.labMPMax}`);
    }

    // ── Throwable projectile ──────────────────────────────────────────────────
    fireThrowable(colorHex, label, iconKey) {
        // Play throwing animation
        this._tryAnim(`char-${this.playerCharId}-projectile`, false);

        const px = this.playerX, py = this.playerY - 20;
        
        const spriteKey = iconKey ? `item-sprite-${iconKey}` : null;
        const hasSprite = spriteKey && this.textures.exists(spriteKey);

        let proj;
        if (hasSprite) {
            proj = this.add.sprite(px, py, spriteKey).setDepth(50);
            this.physics.add.existing(proj);
            const img = proj.texture?.getSourceImage?.();
            const w = img?.width || 24, h = img?.height || 24;
            const s = 24 / Math.max(w, h);
            proj.setDisplaySize(w * s, h * s);
        } else {
            // Use sprite with fallback texture and color tint
            proj = this.add.sprite(px, py, 'lab-fallback').setDepth(50);
            
            // Parse color safely with a fallback
            let color = 0xffffff;
            try {
                if (colorHex) {
                    color = parseInt(colorHex.replace('#', ''), 16);
                    if (isNaN(color)) color = 0xffffff;
                }
            } catch (e) {
                color = 0xffffff;
            }
            proj.setTint(color);
            this.physics.add.existing(proj);
            proj.setDisplaySize(18, 18);
        }

        if (proj.body) {
            proj.body.setAllowGravity(false);
            proj.body.setSize(18, 18);
            proj.body.setVelocity(500, 0);
            proj.body.setAngularVelocity(420);
        }
        proj.thrownLabel = label;
        this.projectiles.add(proj);

        // Load image on the fly if needed
        if (spriteKey && !hasSprite && !this.load.isLoading()) {
            const url = iconKey.endsWith('.png') ? `/Items/sprites/${iconKey}` : `/Items/sprites/${iconKey}.png`;
            this.load.image(spriteKey, url);
            this.load.once(`filecomplete-image-${spriteKey}`, () => {
                if (proj.active && this.textures.exists(spriteKey)) {
                    proj.clearTint(); // Remove fallback color tint
                    proj.setTexture(spriteKey);
                    const img = proj.texture?.getSourceImage?.();
                    const w = img?.width || 24, h = img?.height || 24;
                    const s = 24 / Math.max(w, h);
                    proj.setDisplaySize(w * s, h * s);
                }
            });
            this.load.start();
        }

        this.tweens.add({
            targets: proj, alpha: { from: 1, to: 0.6 }, yoyo: true,
            duration: 200, repeat: -1
        });

        this.time.delayedCall(2000, () => { if (proj.active) proj.destroy(); });
        this._log('throw', `🗡 ${label} lanzado!`);
    }

    _onProjectileHit(proj, dummy) {
        const label = proj.thrownLabel || 'proyectil';
        const dmg   = Phaser.Math.Between(18, 35);
        dummy.hp    = Math.max(0, dummy.hp - dmg);
        const pct   = dummy.hp / dummy.hpMax;
        dummy.hpBar.setDisplaySize(40 * pct, 5);

        this._spawnHitEffect(dummy.x, dummy.y, 0xffffff);
        this._log('hit', `💥 ${label} impacta ${dummy.label} — ${dmg} daño (${dummy.hp}/${dummy.hpMax} HP)`);

        // Flash dummy red
        if (dummy.bodyGfx) {
            dummy.bodyGfx.setAlpha(0.4);
            this.time.delayedCall(180, () => dummy.bodyGfx && dummy.bodyGfx.setAlpha(1));
        }

        proj.destroy();
    }

    // ── Spells ────────────────────────────────────────────────────────────────
    castNova(profile) {
        if (!this._checkMP(profile.mpCost)) return;
        const px = this.playerX, py = this.playerY;
        const MAX_RAD = 180;
        this._screenFlash(profile.flash, 0.4, 120);
        this.cameras.main.shake(300, 0.014);

        const ring = this.add.graphics().setDepth(30);
        let radius  = 10;
        const timer = this.time.addEvent({
            delay: 16, repeat: 30,
            callback: () => {
                ring.clear();
                radius += (MAX_RAD - 10) / 30;
                ring.lineStyle(4, profile.color, Math.max(0, 1 - radius / MAX_RAD));
                ring.strokeCircle(px, py, radius);
                ring.fillStyle(profile.color, 0.07);
                ring.fillCircle(px, py, radius);
                this.dummies.forEach(dummy => {
                    if (!dummy.active || dummy.hp <= 0) return;
                    if (Phaser.Math.Distance.Between(px, py, dummy.x, dummy.y) <= radius) {
                        const dmg = Phaser.Math.Between(40, 80);
                        dummy.hp  = Math.max(0, dummy.hp - dmg);
                        dummy.hpBar.setDisplaySize(40 * (dummy.hp / dummy.hpMax), 5);
                        this._spawnHitEffect(dummy.x, dummy.y, profile.color);
                        this._log('hit', `💜 Nova impacta ${dummy.label} — ${dmg} daño`);
                    }
                });
            },
        });
        this.time.delayedCall(540, () => { ring.destroy(); timer.remove(); });
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const spark = this.add.circle(px, py, 5, profile.color, 0.9).setDepth(9000);
            this.tweens.add({ targets: spark, x: px + Math.cos(angle) * 120, y: py + Math.sin(angle) * 120, alpha: 0, scale: 0.2, duration: 500, ease: 'Power2', onComplete: () => spark.destroy() });
        }
        this._log('nova', `💜 Nova lanzada! (${profile.mpCost} MP)`);
    }

    castFireRain(profile) {
        if (!this._checkMP(profile.mpCost)) return;
        const DROPS = 14, px = this.playerX, py = this.playerY;
        this._screenFlash(profile.flash, 0.25, 180);
        this.time.addEvent({
            delay: 110, repeat: DROPS - 1,
            callback: () => {
                const x = px + Phaser.Math.Between(-250, 250);
                const ball = this.add.circle(x, py - 300, 9, profile.color, 0.95).setDepth(9000);
                this.tweens.add({
                    targets: ball, y: py + Phaser.Math.Between(-30, 30),
                    duration: 360, ease: 'Quad.easeIn',
                    onComplete: () => {
                        this._spawnHitEffect(ball.x, ball.y);
                        this.dummies.forEach(dummy => {
                            if (dummy.hp <= 0) return;
                            if (Math.abs(dummy.x - ball.x) < 55 && Math.abs(dummy.y - ball.y) < 70) {
                                const dmg = Phaser.Math.Between(15, 30);
                                dummy.hp  = Math.max(0, dummy.hp - dmg);
                                dummy.hpBar.setDisplaySize(40 * (dummy.hp / dummy.hpMax), 5);
                                this._log('hit', `🔥 Fire Rain impacta ${dummy.label} — ${dmg} daño`);
                            }
                        });
                        ball.destroy();
                    },
                });
            },
        });
        this._log('fire_rain', `🔥 Fire Rain lanzado! (${profile.mpCost} MP)`);
    }

    castWave(profile) {
        if (!this._checkMP(profile.mpCost)) return;
        const py = this.playerY - 10;
        this._screenFlash(profile.flash, 0.2, 140);
        const wave = this.add.rectangle(this.playerX + 30, py, 70, 60, profile.color, 0.65).setDepth(9000);
        wave.setStrokeStyle(3, 0x88ddff, 1);
        const timer = this.time.addEvent({
            delay: 16, repeat: 44,
            callback: () => {
                wave.x += 14;
                this.dummies.forEach(dummy => {
                    if (dummy.hp <= 0) return;
                    if (Math.abs(dummy.x - wave.x) < 50 && Math.abs(dummy.y - py) < 65) {
                        const dmg = Phaser.Math.Between(20, 50);
                        dummy.hp  = Math.max(0, dummy.hp - dmg);
                        dummy.hpBar.setDisplaySize(40 * (dummy.hp / dummy.hpMax), 5);
                        this._spawnHitEffect(dummy.x, dummy.y, profile.color);
                        this._log('hit', `🌊 Wave impacta ${dummy.label} — ${dmg} daño`);
                    }
                });
            },
        });
        this.time.delayedCall(740, () => { wave.destroy(); timer.remove(); });
        this._log('wave', `🌊 Wave lanzada! (${profile.mpCost} MP)`);
    }

    _checkMP(cost) {
        if (this.labMP < cost) {
            this._log('info', `❌ MP insuficiente (req ${cost}, tienes ${this.labMP})`);
            return false;
        }
        this.labMP = Math.max(0, this.labMP - cost);
        this._updateMPBar();
        return true;
    }

    resetDummies() {
        if (this.enemyTimer) {
            this.enemyTimer.remove();
            this.enemyTimer = null;
        }
        
        // Re-spawn standard dummies in all slots
        const W = this.scale.width, H = this.scale.height;
        const y = H * 0.60;
        const xs = [W * 0.45, W * 0.62, W * 0.79];

        this.dummies.forEach((d, i) => {
            if (d) {
                if (d.bodyGfx) d.bodyGfx.destroy();
                if (d.hpBar) d.hpBar.destroy();
                if (d.hpBg) d.hpBg.destroy();
                if (d.textLabel) d.textLabel.destroy();
                this.dummyGroup.remove(d);
                d.destroy();
            }
            this.dummies[i] = this._createDummyAt(xs[i], y, `Dummy ${i + 1}`);
        });

        this.labMP = this.labMPMax;
        this._updateMPBar();
        this._log('info', '🔄 Arena de entrenamiento reestablecida');
    }

    _screenFlash(color, alpha, duration) {
        const cam = this.cameras?.main;
        if (!cam) return;
        const flash = this.add.rectangle(0, 0, cam.width, cam.height, color, alpha).setOrigin(0).setScrollFactor(0).setDepth(9998);
        this.tweens.add({ targets: flash, alpha: 0, duration, onComplete: () => flash.destroy() });
    }

    _spawnHitEffect(x, y, color = 0xffdd00) {
        const flash = this.add.circle(x, y, 14, color, 0.85).setDepth(1000);
        this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 180, onComplete: () => flash.destroy() });
    }
}

// ── Log Panel ─────────────────────────────────────────────────────────────────
const LOG_ICONS = { fire_rain: '🔥', wave: '🌊', nova: '💜', throw: '🗡', hit: '💥', info: 'ℹ️', enemy_attack: '😈' };

const LogPanel = ({ logs }) => {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
    return (
        <div ref={ref} className="h-48 overflow-y-auto space-y-1 p-3 bg-black/50 rounded-xl border border-white/5 custom-scrollbar">
            {logs.length === 0 && <p className="text-gray-700 text-xs italic">Sin actividad…</p>}
            {logs.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono">
                    <span className="text-gray-600 shrink-0 tabular-nums">{entry.time}</span>
                    <span>{LOG_ICONS[entry.type] || '•'}</span>
                    <span style={{ color: LOG_COLORS[entry.type] || '#88' }}>{entry.text}</span>
                </div>
            ))}
        </div>
    );
};

// ── Action Button ─────────────────────────────────────────────────────────────
const ActionBtn = ({ label, desc, color, onClick, icon, mpCost }) => (
    <button
        onClick={onClick}
        className="group flex items-start gap-3 w-full p-3 rounded-xl border border-white/5 bg-white/3 hover:bg-white/8 hover:border-white/15 transition-all text-left"
    >
        <span className="text-2xl mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color }}>{label}</span>
                {mpCost && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{mpCost} MP</span>}
            </div>
            <p className="text-gray-600 text-[11px] mt-0.5 line-clamp-1">{desc}</p>
        </div>
        <ChevronRight size={14} className="text-gray-700 group-hover:text-gray-400 transition-colors mt-1 shrink-0" />
    </button>
);

// ── Main Component ────────────────────────────────────────────────────────────
export const AdminCombatLab = () => {
    const canvasRef = useRef(null);
    const gameRef   = useRef(null);
    const sceneRef  = useRef(null);
    const [logs, setLogs]         = useState([]);
    const [charId, setCharId]     = useState('1');
    const [started, setStarted]   = useState(false);
    const [skills, setSkills]     = useState([]);
    const [throwables, setThrowables] = useState([]);
    const [enemies, setEnemies]   = useState([]);

    const addLog = useCallback((type, text) => {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        setLogs(l => [...l.slice(-80), { type, text, time }]);
    }, []);

    // Fetch skills, throwables, and enemies from the API
    useEffect(() => {
        api.get('/admin/skills').then(({ data }) => setSkills(Array.isArray(data) ? data : [])).catch(() => {});
        api.get('/admin/enemies').then(({ data }) => setEnemies(Array.isArray(data) ? data : [])).catch(() => {});
        api.get('/admin/items').then(({ data }) => {
            if (Array.isArray(data)) {
                const filtered = data.filter(item => item.item_type === 'throwable');
                const mapped = filtered.map(item => ({
                    label: item.name,
                    cssColor: item.effect_value > 50 ? '#ff3333' : item.effect_value > 25 ? '#ffcc00' : '#44ccff',
                    icon: item.icon_key ? '📦' : '🗡️',
                    desc: item.description || `Daño: ${item.effect_value}`,
                    iconKey: item.icon_key,
                }));
                setThrowables(mapped.length > 0 ? mapped : THROWABLE_PROFILES);
            } else {
                setThrowables(THROWABLE_PROFILES);
            }
        }).catch(() => {
            setThrowables(THROWABLE_PROFILES);
        });
    }, []);

    const startLab = useCallback(() => {
        if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }

        const scene = new CombatLabScene();
        scene.playerCharId = charId;
        scene.addLog = addLog;
        sceneRef.current = scene;

        const game = new Phaser.Game({
            type: Phaser.AUTO,
            width: 780,
            height: 380,
            backgroundColor: '#0a0a1a',
            parent: canvasRef.current,
            physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
            scene: [scene],
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: 780,
                height: 380,
            },
        });
        gameRef.current = game;
        setStarted(true);
    }, [charId, addLog]);

    useEffect(() => {
        return () => { if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; } };
    }, []);

    const getScene = () => {
        if (!gameRef.current) return null;
        return gameRef.current.scene.getScene('CombatLabScene');
    };

    const doThrow    = (t)  => getScene()?.fireThrowable(t.cssColor, t.label, t.iconKey);
    const doSpell    = (k)  => {
        const sc = getScene(), p = SPELL_PROFILES[k];
        if (!sc || !p) return;
        sc._tryAnim(`char-${sc.playerCharId}-special`, false);
        if (k === 'nova') sc.castNova(p);
        else if (k === 'fire_rain') sc.castFireRain(p);
        else sc.castWave(p);
    };
    const doReset    = ()   => getScene()?.resetDummies();
    const spawnEnemy = (e)  => getScene()?.spawnCustomEnemy(e);

    const SPELL_ICONS = { fire_rain: '🔥', wave: '🌊', nova: '💜' };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-orange-400 via-red-400 to-orange-500 bg-clip-text text-transparent uppercase font-medieval drop-shadow-md">
                    Combat Lab
                </h1>
                <p className="text-gray-500 text-sm mt-1">Sandbox de arrojables y habilidades — valida efectos visuales en tiempo real</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
                {/* Left: canvas + log */}
                <div className="space-y-3">
                    {/* Character selector + launch */}
                    {!started && (
                        <div className="flex items-center gap-3 flex-wrap">
                            <div>
                                <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Personaje (ID)</label>
                                <select
                                    value={charId} onChange={e => setCharId(e.target.value)}
                                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500/50"
                                >
                                    {['1','2','3','4','5','6','7','8'].map(id => <option key={id} value={id}>Personaje {id}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={startLab}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] text-white font-bold text-sm rounded-xl transition-all mt-5"
                            >
                                <Play size={16} /> Iniciar Lab
                            </button>
                        </div>
                    )}

                    {/* Canvas */}
                    <div
                        ref={canvasRef}
                        className="rounded-2xl overflow-hidden border border-white/10 bg-black/40"
                        style={{ minHeight: 380 }}
                    >
                        {!started && (
                            <div className="flex items-center justify-center h-96 text-gray-700">
                                <div className="text-center">
                                    <FlaskConical size={48} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Selecciona un personaje y pulsa <strong className="text-gray-500">Iniciar Lab</strong></p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls when started */}
                    {started && (
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={doReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 text-xs transition-all">
                                <RotateCcw size={13} /> Reiniciar dummies
                            </button>
                            <button onClick={() => { setLogs([]); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 text-xs transition-all">
                                <Activity size={13} /> Limpiar log
                            </button>
                            <button onClick={startLab} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl text-orange-400 text-xs transition-all">
                                <RotateCcw size={13} /> Reiniciar escena
                            </button>
                        </div>
                    )}

                    {/* Activity log */}
                    <div>
                        <p className="text-gray-600 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Activity size={12} /> Log de combate
                        </p>
                        <LogPanel logs={logs} />
                    </div>
                </div>

                {/* Right: action panel */}
                <div className="space-y-4">
                    {/* Enemies & Bosses */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                            <Swords size={13} /> Enemigos y Jefes
                        </h3>
                        {enemies.length === 0 ? (
                            <p className="text-[11px] text-gray-600 italic">No hay enemigos creados en la BD</p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                {enemies.map(enemy => (
                                    <div key={enemy.id} className="flex items-center justify-between p-2 rounded-lg bg-white/3 border border-white/5">
                                        <div className="min-w-0 flex-1 mr-2">
                                            <p className="text-white text-xs font-semibold truncate flex items-center gap-1">
                                                {enemy.ai_behavior === 'boss' && <ShieldAlert size={10} className="text-red-400 shrink-0" />}
                                                {enemy.name}
                                            </p>
                                            <p className="text-gray-600 text-[10px] capitalize">Lv.{enemy.level} · {enemy.ai_behavior}</p>
                                        </div>
                                        <button
                                            onClick={() => spawnEnemy(enemy)}
                                            disabled={!started}
                                            className="px-2 py-1 text-[10px] bg-orange-500/15 hover:bg-orange-500/30 text-orange-400 rounded-lg border border-orange-500/20 transition-all disabled:opacity-30"
                                        >
                                            Invocar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Throwables */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                            <Package size={13} /> Arrojables
                        </h3>
                        <div className="space-y-2">
                            {throwables.map(t => (
                                <ActionBtn
                                    key={t.label}
                                    label={t.label}
                                    desc={t.desc}
                                    color={t.cssColor}
                                    icon={t.icon}
                                    onClick={() => doThrow(t)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Spells */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                            <Sparkles size={13} /> Hechizos (Scrolls)
                        </h3>
                        <div className="space-y-2">
                            {Object.entries(SPELL_PROFILES).map(([key, profile]) => (
                                <ActionBtn
                                    key={key}
                                    label={profile.label}
                                    desc={profile.desc}
                                    color={`#${profile.color.toString(16).padStart(6, '0')}`}
                                    icon={SPELL_ICONS[key]}
                                    mpCost={profile.mpCost}
                                    onClick={() => doSpell(key)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* DB Skills */}
                    {skills.length > 0 && (
                        <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                                <Zap size={13} /> Skills en BD
                            </h3>
                            <div className="space-y-1.5">
                                {skills.map(sk => (
                                    <div key={sk.id} className="flex items-center justify-between p-2 rounded-lg bg-white/3 border border-white/5">
                                        <div>
                                            <p className="text-white text-xs font-semibold">{sk.name}</p>
                                            <p className="text-gray-600 text-[10px]">{sk.skill_type} · {sk.mp_cost} MP · pwr {sk.power}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                addLog('info', `🧿 Skill "${sk.name}" ejecutado (visual: ${sk.animation_key})`);
                                                const sc = getScene();
                                                if (!sc) return;
                                                // Trigger character cast animation
                                                sc._tryAnim(`char-${sc.playerCharId}-special`, false);
                                                const fakeProfile = { mpCost: sk.mp_cost, color: 0xaa44ff, flash: 0xcc44ff };
                                                if (sk.animation_key === 'fire_rain') { fakeProfile.color = 0xff4400; fakeProfile.flash = 0xff2200; sc.castFireRain(fakeProfile); }
                                                else if (sk.animation_key === 'wave') { fakeProfile.color = 0x44aaff; fakeProfile.flash = 0x4488ff; sc.castWave(fakeProfile); }
                                                else sc.castNova(fakeProfile);
                                            }}
                                            className="px-2 py-1 text-[10px] bg-purple-500/15 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/20 transition-all"
                                        >
                                            Probar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tip */}
                    <div className="text-[11px] text-gray-700 bg-white/3 border border-white/5 rounded-xl p-3 leading-relaxed">
                        💡 Los arrojables se lanzan hacia los dummies. Los hechizos usan MP (se reinicia con «Reiniciar dummies»). Los dummies muestran su HP en tiempo real.
                    </div>
                </div>
            </div>
        </div>
    );
};
