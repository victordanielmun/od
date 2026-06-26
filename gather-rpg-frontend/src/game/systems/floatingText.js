// Número de daño flotante estilo arcade: aparece sobre el objetivo, sube y se desvanece.
// Reutilizable desde cualquier escena (EnemySprite, CombatSystem, etc.).
export function spawnDamageNumber(scene, x, y, amount, { color = '#ffffff', crit = false } = {}) {
  if (!scene || !scene.add || amount == null) return;
  const value = Math.round(amount);
  if (value <= 0) return;

  const txt = scene.add.text(x, y, `${value}`, {
    fontFamily: '"Outfit", sans-serif',
    fontSize: crit ? '26px' : '19px',
    fontStyle: '900',
    color,
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(99999);

  // Pequeño desvío horizontal aleatorio para que números seguidos no se solapen.
  const dx = (Math.random() - 0.5) * 30;

  scene.tweens.add({
    targets: txt,
    y: y - 55,
    x: x + dx,
    alpha: { from: 1, to: 0 },
    scale: { from: crit ? 1.3 : 1, to: 1 },
    duration: 700,
    ease: 'Cubic.easeOut',
    onComplete: () => txt.destroy(),
  });
}
