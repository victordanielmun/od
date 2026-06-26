import React, { useEffect, useRef, useState } from 'react';
import { Swords, Plus, Trash2, Edit2, Save, X, AlertCircle, Activity, Shield, Zap, Coins, Star, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { ENEMY_CONFIG } from '../../game/config/EnemyConfig';
import { BOSS_CONFIG } from '../../game/config/BossConfig';
import { AI_BEHAVIORS, normalizeBehavior, behaviorLabel } from '../../game/config/enemyBehaviors';

const Phaser = window.Phaser;

// Valores por defecto del formulario. Se usan para limpiar el form al crear uno nuevo
// (antes conservaba los datos del último modelo creado/editado).
const INITIAL_FORM = {
    name: '',
    level: 1,
    hp_max: 100,
    mp_max: 50,
    attack: 10,
    defense: 5,
    speed: 100,
    exp_reward: 20,
    gold_reward: 10,
    ai_behavior: 'melee',
    sprite_key: '1',
    attack_rate: 1000,
    skill_ids: [],
    // Economía de boss (solo se usa si ai_behavior === 'boss').
    mana_max: 100,
    mana_regen: 10,
    hp_regen: 0,
    card_fail_heal_pct: 100
};

// Ajusta la escala para que el frame más grande del enemigo quepa en el canvas.
// Los enemigos 2 y 4 miden ~300px y con un setScale fijo se salían del recuadro.
const computeFitScale = (scene, textureKey, target) => {
    const tex = scene.textures.get(textureKey);
    if (!tex) return 1;
    let maxDim = 0;
    tex.getFrameNames().forEach(name => {
        const fr = tex.frames[name];
        if (fr) maxDim = Math.max(maxDim, fr.width, fr.height);
    });
    return maxDim > 0 ? target / maxDim : 1;
};

// --- Preview Scene for Enemies / Bosses ---
// Un boss usa la estructura de Character (claves 'boss-<id>-<sheet>' y config.sheetType),
// un enemigo usa una sola hoja 'body' (claves 'enemy-<id>-body' y config.type).
class EnemyDefinitionPreviewScene extends Phaser.Scene {
    constructor(spriteKey, isBoss = false) {
        super({ key: `enemy-preview-${isBoss ? 'boss-' : ''}${spriteKey}-${Date.now()}` });
        this.spriteKey = spriteKey;
        this.isBoss = isBoss;
    }

    _meta() {
        if (this.isBoss) {
            return {
                prefix: 'boss',
                baseSheet: 'base',
                def: BOSS_CONFIG.bosses.find(b => b.id.toString() === this.spriteKey.toString()),
                anims: BOSS_CONFIG.animationsByBoss[this.spriteKey],
                sheetTypeOf: c => c.sheetType,
            };
        }
        return {
            prefix: 'enemy',
            baseSheet: 'body',
            def: ENEMY_CONFIG.enemies.find(e => e.id.toString() === this.spriteKey.toString()),
            anims: ENEMY_CONFIG.animationsByEnemy[this.spriteKey],
            sheetTypeOf: c => c.type,
        };
    }

    preload() {
        const { prefix, def } = this._meta();
        if (!def) return;
        def.sheets.forEach(sheet => {
            const key = `${prefix}-${this.spriteKey}-${sheet.type}`;
            if (!this.textures.exists(key)) {
                this.load.atlas(key, sheet.path, sheet.json);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        const { prefix, baseSheet, anims, sheetTypeOf } = this._meta();
        if (!anims) return;

        Object.entries(anims).forEach(([animName, config]) => {
            const textureKey = `${prefix}-${this.spriteKey}-${sheetTypeOf(config)}`;
            const animKey = `${prefix}-${this.spriteKey}-${animName}`;

            if (!this.anims.exists(animKey) && this.textures.exists(textureKey)) {
                this.anims.create({
                    key: animKey,
                    frames: config.frames.map(f => ({ key: textureKey, frame: f })),
                    frameRate: config.frameRate,
                    repeat: config.repeat
                });
            }
        });

        const mainTexture = `${prefix}-${this.spriteKey}-${baseSheet}`;
        if (this.textures.exists(mainTexture)) {
            this.sprite = this.add.sprite(75, 75, mainTexture);
            this.sprite.setOrigin(0.5, 0.5);
            // Canvas de 150×150 → objetivo ~110px para dejar margen.
            this.sprite.setScale(computeFitScale(this, mainTexture, 110));
            const idleAnim = `${prefix}-${this.spriteKey}-idle`;
            if (this.anims.exists(idleAnim)) {
                this.sprite.play(idleAnim);
            }
        }
    }
}

const EnemyDefinitionCard = ({ definition, onEdit, onDelete }) => {
    const canvasRef = useRef(null);
    const { t } = useTranslation();
    const isBoss = normalizeBehavior(definition.ai_behavior) === 'boss';

    useEffect(() => {
        if (!canvasRef.current) return;
        const game = new Phaser.Game({
            type: Phaser.AUTO,
            width: 150,
            height: 150,
            parent: canvasRef.current,
            backgroundColor: '#1a1a2e',
            scene: new EnemyDefinitionPreviewScene(definition.sprite_key || '1', isBoss),
            audio: { disableWebAudio: true, noAudio: true },
            render: { pixelArt: true },
            input: {
                keyboard: false,
                mouse: false,
                touch: false,
                gamepad: false
            }
        });
        return () => game.destroy(true);
    }, [definition.sprite_key, isBoss]);

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg group hover:border-red-500/50 transition-all">
            <div className="flex justify-center bg-gray-900 p-4 border-b border-gray-700">
                <div ref={canvasRef} className="rounded-lg overflow-hidden border border-gray-800" />
            </div>
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold truncate">{definition.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                LVL {definition.level}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                ID: {definition.id}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button onClick={() => onEdit(definition)} className="p-1.5 text-blue-400 hover:bg-blue-400/20 bg-blue-400/5 rounded-lg transition-colors border border-blue-400/20">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDelete(definition.id)} className="p-1.5 text-red-400 hover:bg-red-400/20 bg-red-400/5 rounded-lg transition-colors border border-red-400/20">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Activity size={10} className="text-green-500" />
                        <span>HP: {definition.hp_max}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Swords size={10} className="text-red-500" />
                        <span>ATK: {definition.attack}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Shield size={10} className="text-blue-500" />
                        <span>DEF: {definition.defense}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Brain size={10} className="text-purple-500" />
                        <span>{behaviorLabel(definition.ai_behavior)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-1 text-[10px] text-yellow-500">
                        <Coins size={10} />
                        <span>{definition.gold_reward}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-blue-400">
                        <Star size={10} />
                        <span>{definition.exp_reward} XP</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminEnemyDefinitions = () => {
    const { t } = useTranslation();
    const [definitions, setDefinitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDef, setEditingDef] = useState(null);
    
    const [formData, setFormData] = useState(INITIAL_FORM);

    // Boss usa los sprites de /boss/, el resto los de /enemys/. El desplegable de sprite
    // cambia de lista según el comportamiento elegido.
    const formIsBoss = normalizeBehavior(formData.ai_behavior) === 'boss';
    const spriteOptions = formIsBoss ? BOSS_CONFIG.bosses : ENEMY_CONFIG.enemies;

    // Al cambiar el comportamiento: si el sprite actual no existe en la nueva categoría
    // (p. ej. pasar a Boss con un sprite de enemigo), se reapunta al primero válido.
    const handleBehaviorChange = (value) => {
        const list = (normalizeBehavior(value) === 'boss' ? BOSS_CONFIG.bosses : ENEMY_CONFIG.enemies)
            .map(x => String(x.id));
        setFormData(prev => ({
            ...prev,
            ai_behavior: value,
            sprite_key: list.includes(String(prev.sprite_key)) ? prev.sprite_key : (list[0] ?? '1'),
        }));
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/enemies');
            setDefinitions(res.data);
            setError(null);
        } catch (err) {
            setError(t('admin.enemies.errors.loading') || 'Error loading enemy models');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingDef) {
                await api.put(`/admin/enemies/${editingDef.id}`, formData);
            } else {
                await api.post('/admin/enemies', formData);
            }
            setIsModalOpen(false);
            setEditingDef(null);
            setFormData(INITIAL_FORM);
            fetchData();
        } catch (err) {
            setError(t('admin.enemies.errors.save') || 'Error saving enemy model');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('common.confirm_delete') || '¿Seguro que deseas eliminar este modelo?')) return;
        try {
            await api.delete(`/admin/enemies/${id}`);
            fetchData();
        } catch (err) {
            setError(t('admin.enemies.errors.delete') || 'Error deleting enemy model');
        }
    };

    const openEditModal = (def) => {
        setEditingDef(def);
        setFormData({ ...def });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                        <Swords size={28} className="text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('admin.nav.enemy_models')}</h1>
                        <p className="text-gray-400 text-sm">Configure base stats and rewards for all enemy types.</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingDef(null); setFormData(INITIAL_FORM); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg hover:scale-105"
                >
                    <Plus size={20} />
                    {t('admin.enemies.form.title_new')}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {definitions.map(def => (
                        <EnemyDefinitionCard 
                            key={def.id} 
                            definition={def} 
                            onEdit={openEditModal} 
                            onDelete={handleDelete} 
                        />
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl z-20">
                            <h2 className="text-xl font-bold text-white">
                                {editingDef ? t('admin.enemies.form.title_edit') : t('admin.enemies.form.title_new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.name')}</label>
                                        <input 
                                            type="text" required
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.level')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.level}
                                                onChange={e => setFormData({...formData, level: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.sprite_key')}</label>
                                            <select
                                                value={formData.sprite_key}
                                                onChange={e => setFormData({...formData, sprite_key: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            >
                                                {spriteOptions.map(e => (
                                                    <option key={e.id} value={e.id}>
                                                        {formIsBoss ? `Boss #${e.id}` : (e.name ? `${e.name} (#${e.id})` : `Enemy #${e.id}`)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.hp_max')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.hp_max}
                                                onChange={e => setFormData({...formData, hp_max: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.mp_max')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.mp_max}
                                                onChange={e => setFormData({...formData, mp_max: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.attack')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.attack}
                                                onChange={e => setFormData({...formData, attack: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.defense')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.defense}
                                                onChange={e => setFormData({...formData, defense: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.speed')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.speed}
                                                onChange={e => setFormData({...formData, speed: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.ai_behavior')}</label>
                                        <select
                                            value={normalizeBehavior(formData.ai_behavior)}
                                            onChange={e => handleBehaviorChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                        >
                                            {AI_BEHAVIORS.map(b => (
                                                <option key={b.value} value={b.value}>{b.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.attack_rate', { defaultValue: 'Cadencia de ataque (ms)' })}</label>
                                        <input
                                            type="number" min="100"
                                            value={formData.attack_rate}
                                            onChange={e => setFormData({...formData, attack_rate: parseInt(e.target.value) || 0})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">{t('admin.enemies.form.attack_rate_hint', { defaultValue: 'ms entre ataques/disparos. Menor = más rápido. Para el lanzador es la cadencia de proyectiles.' })}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.exp_reward')}</label>
                                            <input 
                                                type="number" required
                                                value={formData.exp_reward}
                                                onChange={e => setFormData({...formData, exp_reward: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.gold_reward')}</label>
                                            <input
                                                type="number" required
                                                value={formData.gold_reward}
                                                onChange={e => setFormData({...formData, gold_reward: parseInt(e.target.value)})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Economía de boss: solo se muestra/usa si el comportamiento es Boss. */}
                                    {formIsBoss && (
                                        <div className="mt-1 p-3 bg-amber-900/10 border border-amber-500/20 rounded-lg space-y-3">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400/80">
                                                {t('admin.enemies.form.boss_section', { defaultValue: 'Boss — Maná y regeneración' })}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.mana_max', { defaultValue: 'Maná Máx' })}</label>
                                                    <input
                                                        type="number"
                                                        value={formData.mana_max}
                                                        onChange={e => setFormData({...formData, mana_max: parseInt(e.target.value) || 0})}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.mana_regen', { defaultValue: 'Maná/seg' })}</label>
                                                    <input
                                                        type="number"
                                                        value={formData.mana_regen}
                                                        onChange={e => setFormData({...formData, mana_regen: parseInt(e.target.value) || 0})}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.hp_regen', { defaultValue: 'HP/seg (regen)' })}</label>
                                                    <input
                                                        type="number"
                                                        value={formData.hp_regen}
                                                        onChange={e => setFormData({...formData, hp_regen: parseInt(e.target.value) || 0})}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.enemies.form.card_fail_heal_pct', { defaultValue: '% Heal al fallar card' })}</label>
                                                    <input
                                                        type="number"
                                                        value={formData.card_fail_heal_pct}
                                                        onChange={e => setFormData({...formData, card_fail_heal_pct: parseInt(e.target.value) || 0})}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3 border-t border-gray-800">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-bold transition-all"
                                >
                                    {t('admin.enemies.form.cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all"
                                >
                                    {t('admin.enemies.form.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
