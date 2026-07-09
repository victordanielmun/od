import React, { useEffect, useState } from 'react';
import {
    Zap, Shield, Heart, Star, TrendingUp,
    Sparkles, Flame, Wind, Plus, Trash2, Edit2, Save, X, AlertCircle
} from 'lucide-react';
import api from '../../services/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SKILL_TYPES = [
    { value: 'attack', label: 'Ataque',   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: Flame  },
    { value: 'heal',   label: 'Curación', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  icon: Heart  },
    { value: 'buff',   label: 'Mejora',   color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Shield },
];

const TARGET_TYPES = [
    { value: 'enemy', label: 'Enemigo', color: 'text-orange-400', icon: Flame  },
    { value: 'self',  label: 'Propio',  color: 'text-blue-400',   icon: Heart  },
    { value: 'aoe',   label: 'Área',    color: 'text-purple-400', icon: Sparkles },
    { value: 'ally',  label: 'Aliado',  color: 'text-teal-400',   icon: Shield },
];

const ANIM_PREVIEWS = {
    special:    { label: 'Especial',  cssColor: '#aa44ff', icon: Sparkles },
    projectile: { label: 'Proyectil', cssColor: '#44aaff', icon: Wind     },
    fire_rain:  { label: 'Lluvia',    cssColor: '#ff4400', icon: Flame    },
    wave:       { label: 'Ola',       cssColor: '#44aaff', icon: Wind     },
    nova:       { label: 'Nova',      cssColor: '#cc44ff', icon: Sparkles },
    combo1:     { label: 'Combo 1',   cssColor: '#ffcc00', icon: Zap      },
    combo2:     { label: 'Combo 2',   cssColor: '#ff8800', icon: Zap      },
};
const DEFAULT_ANIM = { label: 'Genérico', cssColor: '#aaaaff', icon: Sparkles };

function getAnimPreview(key) { return ANIM_PREVIEWS[key] || DEFAULT_ANIM; }
function getSkillTypeInfo(type) { return SKILL_TYPES.find(t => t.value === type) || SKILL_TYPES[0]; }
function getTargetTypeInfo(type) { return TARGET_TYPES.find(t => t.value === type) || TARGET_TYPES[0]; }
function powerTier(power) {
    if (power >= 350) return { label: 'Legendario', color: 'text-yellow-300' };
    if (power >= 200) return { label: 'Épico',       color: 'text-purple-400' };
    if (power >= 100) return { label: 'Raro',        color: 'text-blue-400'   };
    return                    { label: 'Común',       color: 'text-gray-400'   };
}

// ── Animated orb ─────────────────────────────────────────────────────────────
const SkillOrb = ({ animKey, size = 56 }) => {
    const p = getAnimPreview(animKey);
    const Icon = p.icon;
    return (
        <div className="rounded-full flex items-center justify-center shrink-0 orb-pulse"
            style={{
                width: size, height: size,
                background: `radial-gradient(circle at 35% 35%, ${p.cssColor}44, ${p.cssColor}11)`,
                boxShadow: `0 0 18px ${p.cssColor}55, inset 0 0 10px ${p.cssColor}22`,
                border: `2px solid ${p.cssColor}55`,
            }}>
            <Icon size={size * 0.42} style={{ color: p.cssColor, filter: `drop-shadow(0 0 6px ${p.cssColor})` }} />
        </div>
    );
};

const Stat = ({ icon: Icon, label, value, color = 'text-gray-300' }) => (
    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
        <Icon size={11} className={color} />
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
);

// ── Skill Card ────────────────────────────────────────────────────────────────
const SkillCard = ({ skill, onEdit, onDelete }) => {
    const typeInfo   = getSkillTypeInfo(skill.skill_type);
    const targetInfo = getTargetTypeInfo(skill.target_type);
    const tier       = powerTier(skill.power);
    const TypeIcon   = typeInfo.icon;
    const TargetIcon = targetInfo.icon;
    const preview    = getAnimPreview(skill.animation_key);

    return (
        <div className="group relative bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/25 transition-all overflow-hidden"
            style={{ boxShadow: 'none' }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: `radial-gradient(circle at 50% 0%, ${preview.cssColor}06, transparent 70%)` }} />

            <div className="relative z-10 flex gap-4">
                <SkillOrb animKey={skill.animation_key} size={60} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                            <h3 className="text-white font-bold text-base truncate leading-tight">{skill.name}</h3>
                            <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{skill.description}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => onEdit(skill)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Editar">
                                <Edit2 size={13} />
                            </button>
                            <button onClick={() => onDelete(skill.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Eliminar">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <Stat icon={TypeIcon}   label="tipo"  value={typeInfo.label}   color={typeInfo.color}   />
                        <Stat icon={TargetIcon} label="target" value={targetInfo.label} color={targetInfo.color} />
                        <Stat icon={Zap}        label="MP"    value={skill.mp_cost}    color="text-blue-400"    />
                        <Stat icon={TrendingUp} label="poder" value={skill.power}      color={tier.color}       />
                        <Stat icon={Star}       label="nivel" value={`Lv ${skill.required_level}`} color="text-amber-400" />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeInfo.bg} ${typeInfo.color} ${typeInfo.border}`}>
                            {typeInfo.label}
                        </span>
                        <span className={`text-[10px] font-bold ${tier.color}`}>✦ {tier.label}</span>
                        {skill.animation_key && (
                            <span className="text-[10px] text-gray-600 font-mono">anim: {skill.animation_key}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const EMPTY_SKILL = {
    name: '', description: '', skill_type: 'attack', mp_cost: 20,
    power: 100, target_type: 'enemy', required_level: 1, animation_key: 'special',
};

const SkillFormModal = ({ skill, onSave, onClose, loading }) => {
    const [form, setForm] = useState(skill ? { ...skill } : { ...EMPTY_SKILL });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const ic = "w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors";
    const lc = "text-gray-400 text-xs uppercase tracking-wider mb-1 block";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900/95 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">{skill?.id ? 'Editar Habilidad' : 'Nueva Habilidad'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className={lc}>Nombre</label>
                        <input className={ic} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre de la habilidad" />
                    </div>
                    <div>
                        <label className={lc}>Descripción</label>
                        <textarea className={ic} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe el efecto..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={lc}>Tipo</label>
                            <select className={ic} value={form.skill_type} onChange={e => set('skill_type', e.target.value)}>
                                {SKILL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lc}>Objetivo</label>
                            <select className={ic} value={form.target_type} onChange={e => set('target_type', e.target.value)}>
                                {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lc}>Costo MP</label>
                            <input type="number" className={ic} value={form.mp_cost} min={0} onChange={e => set('mp_cost', +e.target.value || 0)} />
                        </div>
                        <div>
                            <label className={lc}>Poder</label>
                            <input type="number" className={ic} value={form.power} min={0} onChange={e => set('power', +e.target.value || 0)} />
                        </div>
                        <div>
                            <label className={lc}>Nivel Requerido</label>
                            <input type="number" className={ic} value={form.required_level} min={1} onChange={e => set('required_level', +e.target.value || 1)} />
                        </div>
                        <div>
                            <label className={lc}>Animation Key</label>
                            <select className={ic} value={form.animation_key} onChange={e => set('animation_key', e.target.value)}>
                                {Object.entries(ANIM_PREVIEWS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label} ({k})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <SkillOrb animKey={form.animation_key} size={44} />
                        <div>
                            <p className="text-white text-sm font-semibold">{form.name || 'Vista previa'}</p>
                            <p className="text-gray-500 text-xs">{getAnimPreview(form.animation_key).label} · {form.mp_cost} MP · {form.power} poder</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all text-sm">
                        Cancelar
                    </button>
                    <button onClick={() => onSave(form)} disabled={loading || !form.name.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all disabled:opacity-50">
                        <Save size={15} /> {loading ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const AdminSkills = () => {
    const [skills, setSkills]       = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [editSkill, setEditSkill] = useState(null);
    const [saving, setSaving]       = useState(false);
    const [filter, setFilter]       = useState('all');

    const fetchSkills = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/admin/skills');
            setSkills(Array.isArray(data) ? data : []);
        } catch (e) {
            setError('No se pudieron cargar las habilidades: ' + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSkills(); }, []);

    const handleSave = async (form) => {
        setSaving(true);
        try {
            if (form.id) {
                await api.put(`/admin/skills/${form.id}`, form);
            } else {
                await api.post('/admin/skills', form);
            }
            await fetchSkills();
            setEditSkill(null);
        } catch (e) {
            alert('Error al guardar: ' + (e.response?.data?.error || e.message));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta habilidad?')) return;
        try {
            await api.delete(`/admin/skills/${id}`);
            setSkills(s => s.filter(sk => sk.id !== id));
        } catch (e) {
            alert('Error al eliminar: ' + (e.response?.data?.error || e.message));
        }
    };

    const filtered    = filter === 'all' ? skills : skills.filter(s => s.skill_type === filter);
    const attackCount = skills.filter(s => s.skill_type === 'attack').length;
    const healCount   = skills.filter(s => s.skill_type === 'heal').length;
    const maxPower    = skills.length ? Math.max(...skills.map(s => s.power)) : 0;

    return (
        <>
            <style>{`
                .orb-pulse { animation: orbPulseAnim 2.8s ease-in-out infinite; }
                @keyframes orbPulseAnim { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
            `}</style>

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 via-violet-300 to-purple-500 bg-clip-text text-transparent uppercase font-medieval drop-shadow-md">
                            Habilidades
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Catálogo completo de skills del juego</p>
                    </div>
                    <button onClick={() => setEditSkill({})}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] text-white font-bold text-sm rounded-xl transition-all border border-purple-400/20">
                        <Plus size={16} /> Nueva Habilidad
                    </button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total',     value: skills.length, color: 'text-white',     bg: 'bg-white/5',        icon: Sparkles   },
                        { label: 'Ataque',    value: attackCount,   color: 'text-red-400',   bg: 'bg-red-500/10',     icon: Flame      },
                        { label: 'Curación',  value: healCount,     color: 'text-green-400', bg: 'bg-green-500/10',   icon: Heart      },
                        { label: 'Poder máx', value: maxPower,      color: 'text-yellow-400',bg: 'bg-yellow-500/10',  icon: TrendingUp },
                    ].map(({ label, value, color, bg, icon: Icon }) => (
                        <div key={label} className={`${bg} border border-white/5 rounded-2xl p-4 flex items-center justify-between`}>
                            <div>
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</p>
                                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                            </div>
                            <Icon size={22} className={`${color} opacity-60`} />
                        </div>
                    ))}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2 flex-wrap items-center">
                    {[{ value: 'all', label: 'Todas' }, ...SKILL_TYPES].map(t => (
                        <button key={t.value} onClick={() => setFilter(t.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                filter === t.value
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                    : 'text-gray-500 border-white/5 hover:border-white/15 hover:text-gray-300'
                            }`}>{t.label}
                        </button>
                    ))}
                    <span className="ml-auto text-gray-600 text-xs">
                        {filtered.length} habilidad{filtered.length !== 1 ? 'es' : ''}
                    </span>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                        <AlertCircle size={18} /><p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-600">
                        <Sparkles size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">No hay habilidades</p>
                        <p className="text-sm mt-1">Crea la primera con el botón &ldquo;Nueva Habilidad&rdquo;</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map(skill => (
                            <SkillCard key={skill.id} skill={skill} onEdit={setEditSkill} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>

            {editSkill !== null && (
                <SkillFormModal
                    skill={editSkill?.id ? editSkill : null}
                    onSave={handleSave}
                    onClose={() => setEditSkill(null)}
                    loading={saving}
                />
            )}
        </>
    );
};
