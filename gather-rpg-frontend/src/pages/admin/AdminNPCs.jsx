import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NPC_CONFIG, STATE_TO_ANIM } from '../../game/config/NPCConfig';
import { Users } from 'lucide-react';

const Phaser = window.Phaser;

// ─── Mini Phaser scene to render a single NPC animation ───
class NPCPreviewScene extends Phaser.Scene {
    constructor(npcId) {
        super({ key: `npc-preview-${npcId}-${Date.now()}` });
        this.npcId = npcId;
        this.animSprite = null;
        this.currentAnim = null;
    }

    preload() {
        const npcDef = NPC_CONFIG.npcs.find(n => n.id === this.npcId);
        if (!npcDef) return;
        npcDef.sheets.forEach(sheet => {
            const key = `npc-${this.npcId}-${sheet.type}`;
            if (sheet.json) {
                this.load.atlas(key, sheet.path, sheet.json);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        const npcDef = NPC_CONFIG.npcs.find(n => n.id === this.npcId);
        if (!npcDef) return;

        // Create animations for this NPC
        const npcAnims = NPC_CONFIG.animationsByNPC[this.npcId];
        if (!npcAnims) return;

        Object.entries(npcAnims).forEach(([animName, config]) => {
            const textureKey = `npc-${this.npcId}-${config.type}`;
            const animKey = `npc-${this.npcId}-${animName}`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: config.frames.map(frameName => ({
                        key: textureKey,
                        frame: frameName
                    })),
                    frameRate: config.frameRate,
                    repeat: config.repeat
                });
            }
        });

        // Create sprite centered in canvas
        const baseKey = `npc-${this.npcId}-body`;
        this.animSprite = this.add.sprite(150, 150, baseKey);
        this.animSprite.setScale(1.2);
        this.animSprite.setOrigin(0.5, 0.5);

        // Start with idle body
        this.playAnim('idle-waiting');
    }

    playAnim(animName) {
        if (!this.animSprite) return;
        const key = `npc-${this.npcId}-${animName}`;
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
        className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border ${active
            ? `${color} border-white/30 text-white shadow-lg scale-105`
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
    >
        {label}
    </button>
);

// ─── NPC Preview Card ───
const NPCCard = ({ npcDef }) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const sceneRef = useRef(null);
    const [activeAnim, setActiveAnim] = useState('idle-waiting');

    useEffect(() => {
        if (!canvasRef.current) return;

        const scene = new NPCPreviewScene(npcDef.id);
        sceneRef.current = scene;

        const game = new Phaser.Game({
            type: Phaser.CANVAS,
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
    }, [npcDef.id]);

    const handleAnimClick = (animName) => {
        setActiveAnim(animName);
        sceneRef.current?.playAnim(animName);
    };

    // Animation groups (Portraits vs Body)
    const portraitAnims = [
        { key: 'portrait-idle', label: 'P-Idle', color: 'bg-blue-600' },
        { key: 'portrait-talking', label: 'P-Talk', color: 'bg-green-600' },
        { key: 'portrait-happy', label: 'P-Happy', color: 'bg-yellow-600' },
        { key: 'portrait-sad', label: 'P-Sad', color: 'bg-purple-600' },
        { key: 'portrait-angry', label: 'P-Angry', color: 'bg-red-600' },
    ];

    const bodyAnims = [
        { key: 'idle-waiting', label: 'B-Idle', color: 'bg-indigo-600' },
        { key: 'walking', label: 'B-Walk', color: 'bg-cyan-600' },
        { key: 'talking', label: 'B-Talk', color: 'bg-teal-600' },
        { key: 'happy-grateful', label: 'B-Happy', color: 'bg-orange-600' },
        { key: 'sad', label: 'B-Sad', color: 'bg-pink-600' },
        { key: 'dying', label: 'B-Die', color: 'bg-red-900' },
    ];

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                <h3 className="text-white font-bold text-sm">
                    NPC #{npcDef.id}
                </h3>
                <span className="text-[10px] text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                    {npcDef.sheets.length} sprite sheet{npcDef.sheets.length > 1 ? 's' : ''}
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
            <div className="text-center py-2 bg-gray-900">
                <span className="text-xs text-gray-400">{t('admin.npcs.animation')}: </span>
                <span className="text-xs text-yellow-400 font-bold uppercase">{activeAnim}</span>
            </div>

            {/* Portrait Animations */}
            <div className="px-4 pb-2">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Portrait (A)</p>
                <div className="flex flex-wrap gap-1.5">
                    {portraitAnims.map(a => (
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

            {/* Body Animations */}
            <div className="px-4 pb-4 pt-1">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Body (B)</p>
                <div className="flex flex-wrap gap-1.5">
                    {bodyAnims.map(a => (
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
                    {npcDef.sheets.map(s => (
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
export const AdminNPCs = () => {
    const { t } = useTranslation();
    const npcs = NPC_CONFIG.npcs;

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <Users size={28} className="text-yellow-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('admin.npcs.title')}</h1>
                    <p className="text-gray-400 text-sm">{t('admin.npcs.subtitle')}</p>
                </div>
            </div>

            {npcs.length === 0 ? (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-12 text-center">
                    <Users size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">{t('admin.npcs.empty')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {npcs.map(npcDef => (
                        <NPCCard key={npcDef.id} npcDef={npcDef} />
                    ))}
                </div>
            )}

            <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
                <p className="font-bold text-gray-400 mb-1">💡 {t('admin.npcs.tutorial_title')}</p>
                <ol className="list-decimal list-inside space-y-1">
                    {t('admin.npcs.tutorial_steps', { returnObjects: true }).map((step, idx) => (
                        <li key={idx}>{step}</li>
                    ))}
                </ol>
            </div>
        </div>
    );
};
