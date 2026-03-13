package combat

import (
	"math/rand"
)

type DamageCalculator struct{}

func NewDamageCalculator() *DamageCalculator {
	return &DamageCalculator{}
}

func (dc *DamageCalculator) CalculatePhysicalDamage(attackerATK, defenderDEF int) (int, bool) {
	baseDamage := float64(attackerATK) - (float64(defenderDEF) * 0.5)
	if baseDamage < 1 {
		baseDamage = 1
	}

	// Variance +/- 10%
	variance := rand.Float64()*0.2 - 0.1
	damage := int(baseDamage * (1 + variance))

	// Critical hit (5% chance)
	isCritical := rand.Float64() < 0.05
	if isCritical {
		damage = int(float64(damage) * 1.5)
	}

	if damage < 1 {
		damage = 1
	}

	return damage, isCritical
}

func (dc *DamageCalculator) CalculateSkillDamage(attackerATK int, skillPower int, defenderDEF int) int {
	// base_damage = (skill.power / 100) * attacker.ATK
	baseDamage := (float64(skillPower) / 100.0) * float64(attackerATK)

	// ignore_defense = 30%
	effectiveDef := float64(defenderDEF) * 0.7

	finalDamage := baseDamage - (effectiveDef * 0.3)

	if finalDamage < 1 {
		finalDamage = 1
	}

	return int(finalDamage)
}

func (dc *DamageCalculator) CalculateHeal(healerATK int, skillPower int, currentHP, maxHP int) int {
	healAmount := int((float64(skillPower) / 100.0) * float64(healerATK) * 0.5)

	if currentHP+healAmount > maxHP {
		healAmount = maxHP - currentHP
	}

	return healAmount
}
