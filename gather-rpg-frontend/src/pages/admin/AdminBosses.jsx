import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOSS_CONFIG } from '../../game/config/BossConfig';
import { Crown, Activity, Info } from 'lucide-react';

const Phaser = window.Phaser;

// ─── Mini Phaser scene to render a single boss animation ───
class BossPreviewScene extends Phaser.Scene {
    constructor(bossId) {
        super({ key: `boss-preview-${bossId}-${Date.now()}` });
        this.bossId = bossId;
        this.animSprite = null;
        this.currentAnim = null;
    }

    preload() {
        const bossDef = BOSS_CONFIG.bosses.find(b => b.id === this.bossId);
        if (!bossDef) return;
        bossDef.sheets.forEach(sheet => {
            const key = `boss-${this.bossId}-${sheet.type}`;
            if (sheet.json && !this.textures.exists(key)) {
                this.load.atlas(key, sheet.path, sheet.json);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        const bossDef = BOSS_CONFIG.bosses.find(b => b.id === this.bossId);
        if (!bossDef) return;

        // Create animations for this boss using per-boss frame map
        const bossAnimations =
            BOSS_CONFIG.animationsByBoss[this.bossId] || {};

        Object.entries(bossAnimations).forEach(([animName, config]) => {
            const textureKey = `boss-${this.bossId}-${config.sheetType}`;
            const animKey = `boss-${this.bossId}-${animName}`;
            if (!this.anims.exists(animKey) && this.textures.exists(textureKey)) {
                const frames = config.frames.map(frameName => ({
                    key: textureKey,
                    frame: frameName
                }));
                this.anims.create({
                    key: animKey,
                    frames,
                    frameRate: config.frameRate,
                    repeat: config.repeat
                });
            }
        });

        // Create sprite centered in canvas
        const baseKey = `boss-${this.bossId}-base`;
        this.animSprite = this.add.sprite(150, 150, baseKey);
        
        // Escalamiento dinámico según el tamaño del sprite para que quepa bien en el preview (300x300 canvas)
        const spriteW = this.animSprite.width || 48;
        const spriteH = this.animSprite.height || 48;
        let scale = 1.0;
        if (spriteW > 100 || spriteH > 100) {
            scale = Math.min(220 / spriteW, 220 / spriteH);
        } else {
            scale = 2.0; // Agranda sprites pequeños
        }
        this.animSprite.setScale(scale);
        this.animSprite.setOrigin(0.5, 0.5);

        // Listen for animation completion to auto-return one-shots to idle
        this.animSprite.on('animationcomplete', (animation) => {
            const completedAnimName = animation.key.replace(`boss-${this.bossId}-`, '');
            const autoReturnToIdle = [
                'hurt',
                'combo1',
                'combo2',
                'combo3_finisher',
                'special',
                'projectile',
                'potion',
                'strong',
                'kick'
            ];

            if (autoReturnToIdle.includes(completedAnimName)) {
                this.playAnim('idle');
                if (this.onAnimComplete) {
                    this.onAnimComplete('idle');
                }
            }
        });

        // Start with idle
        this.playAnim('idle');
    }

    playAnim(animName) {
        if (!this.animSprite) return;
        const key = `boss-${this.bossId}-${animName}`;
        this.currentAnim = animName;
        if (this.anims.exists(key)) {
            this.animSprite.play(key, true);
        }
    }
}

// ─── Animation button component ───
const AnimButton = ({ label, active, onClick, color }) => (
    <button
        onClick={onClick}
        className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${active
            ? `${color} border-white/30 text-white shadow-lg scale-105`
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
    >
        {label}
    </button>
);

// ─── Boss Preview Card ───
const BossCard = ({ bossDef }) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const sceneRef = useRef(null);
    const [activeAnim, setActiveAnim] = useState('idle');

    useEffect(() => {
        if (!canvasRef.current) return;

        const scene = new BossPreviewScene(bossDef.id);
        scene.onAnimComplete = (animName) => {
            setActiveAnim(animName);
        };
        sceneRef.current = scene;

        const game = new Phaser.Game({
            type: Phaser.AUTO,
            width: 300,
            height: 300,
            parent: canvasRef.current,
            backgroundColor: '#1a1a2e',
            scene: scene,
            audio: { disableWebAudio: true, noAudio: true },
            physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
            scale: { mode: Phaser.Scale.NONE },
            render: { pixelArt: true },
            input: {
                keyboard: false,
                mouse: false,
                touch: false,
                gamepad: false
            }
        });
        gameRef.current = game;

        return () => {
            game.destroy(true);
        };
    }, [bossDef.id]);

    const handleAnimClick = (animName) => {
        setActiveAnim(animName);
        sceneRef.current?.playAnim(animName);
    };

    // Animation groups
    const combatAnims = [
        { key: 'combo1', label: 'Ataque Base (combo1)', color: 'bg-amber-600' },
        { key: 'special', label: 'Especial (special)', color: 'bg-fuchsia-600' },
        { key: 'projectile', label: 'Lanzar (projectile)', color: 'bg-indigo-600' },
    ];

    const baseAnims = [
        { key: 'idle', label: 'Idle', color: 'bg-blue-600' },
        { key: 'walk', label: 'Caminar (walk)', color: 'bg-green-600' },
        { key: 'hurt', label: 'Hurt', color: 'bg-orange-600' },
        { key: 'die', label: 'Die', color: 'bg-red-800' },
    ];

    return (
        <div className="bg-gray-900 border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col group">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-950/40 to-gray-800 border-b border-amber-700/40">
                <div className="flex items-center gap-2">
                    <Crown size={16} className="text-amber-400" />
                    <h3 className="text-white font-black tracking-tight text-lg">
                        Jefe #{bossDef.id}
                    </h3>
                </div>
                <span className="text-[10px] text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                    {bossDef.sheets.length} sprite sheets
                </span>
            </div>

            {/* Phaser Canvas */}
            <div className="flex justify-center bg-gray-950 p-4">
                <div
                    ref={canvasRef}
                    className="rounded-xl overflow-hidden border border-amber-900/40 w-full max-w-[300px] aspect-square"
                />
            </div>

            {/* Active Animation Label */}
            <div className="text-center py-2 bg-gray-900/80 flex justify-center gap-2 border-b border-gray-800/40">
                <span className="text-xs text-gray-500">Animación actual:</span>
                <span className="text-xs text-amber-400 font-bold uppercase">{activeAnim}</span>
            </div>

            {/* Combat Animations */}
            <div className="px-5 py-3 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                    <Activity size={10} /> Combate
                </p>
                <div className="flex flex-wrap gap-2">
                    {combatAnims.map(a => (
                        <AnimButton
                            key={a.key}
                            label={a.label}
                            active={activeAnim === a.key}
                            onClick={() => handleAnimClick(a.key)}
                            color={a.color}
                        />
                    ))}
                </div>
            </div>

            {/* Base Animations */}
            <div className="px-5 py-3 space-y-2 border-t border-gray-800/40">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                    <Activity size={10} /> Movimiento / Base
                </p>
                <div className="flex flex-wrap gap-2">
                    {baseAnims.map(a => (
                        <AnimButton
                            key={a.key}
                            label={a.label}
                            active={activeAnim === a.key}
                            onClick={() => handleAnimClick(a.key)}
                            color={a.color}
                        />
                    ))}
                </div>
            </div>

            {/* Sheets Info */}
            <div className="px-5 pb-5 pt-3 border-t border-gray-800/55">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Sprite Sheets</p>
                <div className="space-y-1">
                    {bossDef.sheets.map(s => (
                        <div key={s.type} className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-amber-400">{s.type}</span>
                            <span className="text-gray-500 truncate max-w-[200px]" title={s.path}>{s.path}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Main Admin Page ───
export const AdminBosses = () => {
    const bosses = BOSS_CONFIG.bosses;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <Crown size={32} className="text-amber-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent uppercase font-medieval drop-shadow-md">
                        Visualizador de Jefes
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Valida las hojas de sprites (base, combat, avatar) y animaciones de los bosses en Phaser</p>
                </div>
            </div>

            {bosses.length === 0 ? (
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center">
                    <Crown size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">No hay bosses configurados en BossConfig.js</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {bosses.map(bossDef => (
                        <BossCard key={bossDef.id} bossDef={bossDef} />
                    ))}
                </div>
            )}

            <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-xl p-5 shadow-lg">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                    <Info size={18} className="text-amber-400" />
                    Notas Técnicas del Jefazo
                </h4>
                <ul className="space-y-2 text-xs text-gray-400 list-disc list-inside">
                    <li>Los bosses usan un sistema multi-sheet idéntico al del jugador (con extensiones a, b, c y d).</li>
                    <li>Las animaciones cargadas provienen de la carpeta `/public/boss/` autogenerada.</li>
                    <li>Puedes utilizar los botones de animación anteriores para probar las transiciones e interrupciones en tiempo real.</li>
                </ul>
            </div>
        </div>
    );
};
