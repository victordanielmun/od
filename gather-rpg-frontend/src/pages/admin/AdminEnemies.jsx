import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENEMY_CONFIG } from '../../game/config/EnemyConfig';
import { Swords, Activity, Info } from 'lucide-react';

const Phaser = window.Phaser;

// ─── Mini Phaser scene to render an Enemy animation ───
class EnemyPreviewScene extends Phaser.Scene {
    constructor(enemyId) {
        super({ key: `enemy-preview-${enemyId}-${Date.now()}` });
        this.enemyId = enemyId;
        this.animSprite = null;
    }

    preload() {
        const enemyDef = ENEMY_CONFIG.enemies.find(e => e.id === this.enemyId);
        if (!enemyDef) return;
        enemyDef.sheets.forEach(sheet => {
            const key = `enemy-${this.enemyId}-${sheet.type}`;
            if (!this.textures.exists(key)) {
                this.load.atlas(key, sheet.path, sheet.json);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        const enemyAnims = ENEMY_CONFIG.animationsByEnemy[this.enemyId];
        if (!enemyAnims) return;

        Object.entries(enemyAnims).forEach(([animName, config]) => {
            const textureKey = `enemy-${this.enemyId}-${config.type}`;
            const animKey = `enemy-${this.enemyId}-${animName}`;
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

        const baseKey = `enemy-${this.enemyId}-body`;
        this.animSprite = this.add.sprite(150, 150, baseKey);
        this.animSprite.setScale(2);
        this.animSprite.setOrigin(0.5, 0.5);

        this.playAnim('idle');
    }

    playAnim(animName) {
        if (!this.animSprite) return;
        const key = `enemy-${this.enemyId}-${animName}`;
        if (this.anims.exists(key)) {
            this.animSprite.play(key, true);
        }
    }
}

const StateButton = ({ label, active, onClick, color }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${active
            ? `${color} border-white/30 text-white shadow-lg scale-105`
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
    >
        {label}
    </button>
);

const EnemyCard = ({ enemyDef }) => {
    const { t } = useTranslation();
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const sceneRef = useRef(null);
    const [activeAnim, setActiveAnim] = useState('idle');

    useEffect(() => {
        if (!canvasRef.current) return;

        const scene = new EnemyPreviewScene(enemyDef.id);
        sceneRef.current = scene;

        const game = new Phaser.Game({
            type: Phaser.CANVAS,
            width: 300,
            height: 300,
            parent: canvasRef.current,
            backgroundColor: '#1a1a2e',
            scene: scene,
            audio: { disableWebAudio: true, noAudio: true },
            physics: { default: 'arcade' },
            render: { pixelArt: true },
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        });
        gameRef.current = game;

        return () => game.destroy(true);
    }, [enemyDef.id]);

    const handleAnimClick = (animName) => {
        setActiveAnim(animName);
        sceneRef.current?.playAnim(animName);
    };

    const anims = [
        { key: 'idle', label: 'IDLE', color: 'bg-indigo-600' },
        { key: 'walking', label: 'CHASE', color: 'bg-cyan-600' },
        { key: 'attack', label: 'ATTACK', color: 'bg-red-600' },
        { key: 'hurt', label: 'HURT', color: 'bg-orange-600' },
        { key: 'knocked', label: 'KNOCK', color: 'bg-purple-600' },
        { key: 'dying', label: 'DEAD', color: 'bg-gray-700' },
    ];

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full hover:border-red-500/30 transition-colors group">
            <div className="px-5 py-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-white font-black tracking-tight text-lg">
                        {t('admin.enemies.card_title', { id: enemyDef.id })}
                    </h3>
                </div>
                <Swords size={18} className="text-gray-500 group-hover:text-red-500 transition-colors" />
            </div>

            <div className="bg-gray-950 p-4 flex justify-center flex-grow">
                <div 
                    ref={canvasRef} 
                    className="rounded-xl overflow-hidden border border-gray-800 shadow-inner w-full max-w-[300px] aspect-square" 
                />
            </div>

            <div className="p-5 space-y-4">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                        <Activity size={10} /> {t('admin.enemies.fsm_states')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {anims.map(a => (
                            <StateButton
                                key={a.key}
                                label={a.label}
                                active={activeAnim === a.key}
                                onClick={() => handleAnimClick(a.key)}
                                color={a.color}
                            />
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-800">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">{t('admin.enemies.sprite_info')}</p>
                    <div className="text-[10px] sm:text-[11px] font-mono text-gray-400 bg-black/30 p-2 rounded-lg border border-gray-800/50 break-all">
                        {enemyDef.sheets[0].path}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminEnemies = () => {
    const { t } = useTranslation();
    const enemies = ENEMY_CONFIG.enemies;

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                    <Swords size={32} className="text-red-500" />
                </div>
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        {t('admin.enemies.title')}
                    </h1>
                    <p className="text-gray-400 text-base sm:text-lg">
                        {t('admin.enemies.subtitle')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {enemies.map(e => <EnemyCard key={e.id} enemyDef={e} />)}
            </div>

            <div className="mt-12 bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-lg">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Info size={18} className="text-red-500" />
                    {t('admin.enemies.tech_notes')}
                </h4>
                <ul className="space-y-3 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold mt-1 leading-none">•</span>
                        <span>{t('admin.enemies.tech_note_1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold mt-1 leading-none">•</span>
                        <span>{t('admin.enemies.tech_note_2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold mt-1 leading-none">•</span>
                        <span>{t('admin.enemies.tech_note_3')}</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};
