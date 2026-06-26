// Arquetipos de comportamiento de enemigo que el MOTOR realmente entiende
// (ver backend room.go EnemyType* y el FSM de EnemySprite.js).
//
// El MODELO de enemigo (admin) es la fuente de verdad: guarda `ai_behavior` con uno
// de estos valores, y el editor de mapas lo hereda como `type` al colocar el enemigo.
// Así el comportamiento se define en un solo sitio.

export const AI_BEHAVIORS = [
    { value: 'melee',   label: 'Normal (cuerpo a cuerpo)' },
    { value: 'fast',    label: 'Rápido' },
    { value: 'thrower', label: 'Lanzador (ataca a distancia)' },
    { value: 'boss',    label: 'Boss' },
];

// Normaliza valores antiguos (aggressive/passive/flee/ranged) al arquetipo del motor,
// para no tener que migrar la BD: los modelos viejos se interpretan al vuelo.
export const normalizeBehavior = (b) => {
    switch (b) {
        case 'ranged':  return 'thrower';
        case 'fast':    return 'fast';
        case 'boss':    return 'boss';
        case 'thrower': return 'thrower';
        case 'melee':   return 'melee';
        default:        return 'melee'; // aggressive / passive / flee / vacío
    }
};

export const behaviorLabel = (b) =>
    AI_BEHAVIORS.find(x => x.value === normalizeBehavior(b))?.label ?? b;
