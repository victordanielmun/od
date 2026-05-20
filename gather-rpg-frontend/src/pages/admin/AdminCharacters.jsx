import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHARACTER_CONFIG } from '../../game/config/CharacterConfig';
import { Users } from 'lucide-react';

const Phaser = window.Phaser;

// ─── Mini Phaser scene to render a single character animation ───
class PreviewScene extends Phaser.Scene {
    constructor(charId) {
        super({ key: `preview-${charId}-${Date.now()}` });
        this.charId = charId;
        this.animSprite = null;
        this.currentAnim = null;
    }

    preload() {
        const charDef = CHARACTER_CONFIG.characters.find(c => c.id === this.charId);
        if (!charDef) return;
        charDef.sheets.forEach(sheet => {
            const key = `char-${this.charId}-${sheet.type}`;
            if (sheet.json && !this.textures.exists(key)) {
                this.load.atlas(key, sheet.path, sheet.json);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        const charDef = CHARACTER_CONFIG.characters.find(c => c.id === this.charId);
        if (!charDef) return;

        // Create animations for this character using per-character frame map
        const charAnimations =
            CHARACTER_CONFIG.animationsByCharacter[this.charId] ||
            CHARACTER_CONFIG.animationsByCharacter['1'];

        Object.entries(charAnimations).forEach(([animName, config]) => {
            const textureKey = `char-${this.charId}-${config.sheetType}`;
            const animKey = `char-${this.charId}-${animName}`;
            if (!this.anims.exists(animKey)) {
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
        const baseKey = `char-${this.charId}-base`;
        this.animSprite = this.add.sprite(150, 150, baseKey);
        this.animSprite.setScale(1.2);
        this.animSprite.setOrigin(0.5, 0.5);

        // Start with idle
        this.playAnim('idle');
    }

    playAnim(animName) {
        if (!this.animSprite) return;
        const key = `char-${this.charId}-${animName}`;
        this.currentAnim = animName;
        this.animSprite.play(key, true);
    }
}

// ─── Animation button component ───
const AnimButton = ({ label, active, onClick, color }) => (
    <button
        onClick={onClick}
        className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border ${active
            ? `${color} border-white/30 text-white shadow-lg scale-105`
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
    >
        {label}
    </button>
);

// ─── Character Preview Card ───
const CharacterCard = ({ charDef }) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const sceneRef = useRef(null);
    const [activeAnim, setActiveAnim] = useState('idle');

    useEffect(() => {
        if (!canvasRef.current) return;

        const scene = new PreviewScene(charDef.id);
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
            render: { pixelArt: true }
        });
        gameRef.current = game;

        return () => {
            game.destroy(true);
        };
    }, [charDef.id]);

    const handleAnimClick = (animName) => {
        setActiveAnim(animName);
        sceneRef.current?.playAnim(animName);
    };

    // Animation groups
    const baseAnims = [
        { key: 'idle', label: 'Idle', color: 'bg-blue-600' },
        { key: 'walk', label: 'Walk', color: 'bg-green-600' },
        { key: 'hurt', label: 'Hurt', color: 'bg-red-600' },
        { key: 'die', label: 'Die', color: 'bg-red-800' },
        { key: 'stun', label: 'Stun', color: 'bg-yellow-600' },
        { key: 'poison', label: 'Poison', color: 'bg-purple-600' },
    ];

    const combatAnims = [
        { key: 'slash', label: 'Slash', color: 'bg-orange-600' },
        { key: 'special', label: 'Special', color: 'bg-pink-600' },
        { key: 'potion', label: 'Potion', color: 'bg-cyan-600' },
        { key: 'projectile', label: 'Projectile', color: 'bg-indigo-600' },
        { key: 'block', label: 'Block', color: 'bg-gray-600' },
    ];

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                <h3 className="text-white font-bold text-sm">
                    Personaje #{charDef.id}
                </h3>
                <span className="text-[10px] text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                    {charDef.sheets.length} sprite sheet{charDef.sheets.length > 1 ? 's' : ''}
                </span>
            </div>

            {/* Phaser Canvas */}
            <div className="flex justify-center bg-gray-950 p-2">
                <div
                    ref={canvasRef}
                    className="rounded-lg overflow-hidden border border-gray-800"
                    style={{ width: 300, height: 300 }}
                />
            </div>

            {/* Active Animation Label */}
            <div className="text-center py-2 bg-gray-900 flex justify-center gap-2">
                <span className="text-xs text-gray-400">{t('admin.characters.animation')}: </span>
                <span className="text-xs text-yellow-400 font-bold uppercase">{activeAnim}</span>
            </div>

            {/* Base Animations */}
            <div className="px-4 pb-2">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Base</p>
                <div className="flex flex-wrap gap-1.5">
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

            {/* Combat Animations */}
            <div className="px-4 pb-4 pt-1">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Combate</p>
                <div className="flex flex-wrap gap-1.5">
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

            {/* Sheets Info */}
            <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Sprite Sheets</p>
                <div className="space-y-1">
                    {charDef.sheets.map(s => (
                        <div key={s.type} className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-300 font-mono">{s.type}</span>
                            <span className="text-gray-500 truncate max-w-[180px]">{s.path}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Main Admin Page ───
export const AdminCharacters = () => {
    const { t } = useTranslation();
    const characters = CHARACTER_CONFIG.characters;

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <Users size={28} className="text-yellow-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('admin.characters.title')}</h1>
                    <p className="text-gray-400 text-sm">{t('admin.characters.subtitle')}</p>
                </div>
            </div>

            {characters.length === 0 ? (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-12 text-center">
                    <Users size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">{t('admin.characters.empty')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {characters.map(charDef => (
                        <CharacterCard key={charDef.id} charDef={charDef} />
                    ))}
                </div>
            )}

            <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
                <p className="font-bold text-gray-400 mb-1">💡 {t('admin.characters.tutorial_title')}</p>
                <ol className="list-decimal list-inside space-y-1">
                    {t('admin.characters.tutorial_steps', { returnObjects: true }).map((step, idx) => (
                        <li key={idx}>{step}</li>
                    ))}
                </ol>
            </div>
        </div>
    );
};
