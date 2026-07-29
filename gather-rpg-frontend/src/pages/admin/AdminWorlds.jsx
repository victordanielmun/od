import { useState, useEffect, useCallback, useMemo } from 'react';
import { Globe, Plus, Trash2, Save, X, Swords, AlertTriangle, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import api, { worldArtUrl } from '../../services/api';

/**
 * AdminWorlds — mundos: agrupan misiones y deciden de qué pool salen las Ninja Cards.
 *
 * Un mundo NO bloquea nada: todos los mundos y todas sus misiones se juegan en
 * cualquier orden. Lo que valida el aprendizaje es su MISIÓN FINAL, un mapa de
 * combate cuyas cards salen exclusivamente del `exam_tag`. Si el jugador no sabe,
 * falla las cards, el boss se cura y no puede terminar el mapa.
 *
 * Por eso lo más delicado de esta pantalla es el semáforo del pool: un `exam_tag`
 * sin preguntas hace que el examen caiga al pool global y deje de evaluar.
 */

const BLANK = {
    key: '', name: '', description_en: '', order: 0,
    challenge_tags: [], challenge_types: [], exam_tag: '',
    difficulty: 'beginner', cover_image: '', status: 'active',
};

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const TYPES = ['vocabulary', 'grammar', 'pronunciation', 'listening'];

const artUrl = worldArtUrl;

export const AdminWorlds = () => {
    const [worlds, setWorlds] = useState([]);
    const [missions, setMissions] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);

    const [editing, setEditing] = useState(null);   // world en edición (o BLANK para nuevo)
    const [linking, setLinking] = useState(null);   // world cuyas misiones se están vinculando
    const [selectedIds, setSelectedIds] = useState([]);
    const [finalId, setFinalId] = useState(0);

    const flash = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 5000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [wRes, mRes] = await Promise.all([
                api.get('/admin/worlds'),
                api.get('/admin/missions'),
            ]);
            setWorlds(wRes.data || []);
            setMissions(mRes.data || []);
        } catch (e) {
            setError(e?.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Tags disponibles para el autocompletado del pool temático.
    useEffect(() => {
        api.get('/learning/challenges/metadata')
            .then(res => setAllTags(res.data?.tags || []))
            .catch(() => setAllTags([]));
    }, []);

    // ── Guardar mundo ────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!editing.key?.trim() || !editing.name?.trim()) {
            flash('error', 'La clave y el nombre son obligatorios');
            return;
        }
        try {
            const payload = { ...editing, order: Number(editing.order) || 0 };
            if (editing.id) await api.put(`/admin/worlds/${editing.id}`, payload);
            else await api.post('/admin/worlds', payload);
            flash('success', editing.id ? 'Mundo actualizado' : 'Mundo creado');
            setEditing(null);
            load();
        } catch (e) {
            flash('error', e?.response?.data?.error || e.message);
        }
    };

    const handleDelete = async (w) => {
        if (!window.confirm(`¿Eliminar el mundo "${w.name}"? Sus misiones NO se borran: quedan como misiones sueltas.`)) return;
        try {
            await api.delete(`/admin/worlds/${w.id}`);
            flash('success', 'Mundo eliminado; sus misiones quedaron sueltas');
            load();
        } catch (e) {
            flash('error', e?.response?.data?.error || e.message);
        }
    };

    // ── Vincular misiones ────────────────────────────────────────────────────
    const openLinking = (w) => {
        setLinking(w);
        setSelectedIds(w.mission_ids || []);
        setFinalId(w.final_mission_id || 0);
    };

    const toggleMission = (id) => {
        setSelectedIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            // Si se quita la que era final, el mundo se queda sin examen.
            if (!next.includes(finalId)) setFinalId(0);
            return next;
        });
    };

    const handleSaveLinks = async () => {
        try {
            await api.put(`/admin/worlds/${linking.id}/missions`, {
                mission_ids: selectedIds,
                final_mission_id: finalId,
            });
            flash('success', 'Misiones vinculadas');
            setLinking(null);
            load();
        } catch (e) {
            flash('error', e?.response?.data?.error || e.message);
        }
    };

    // Misiones tomadas por OTRO mundo: se muestran deshabilitadas para no robarlas
    // sin querer (una misión pertenece a un solo mundo).
    const takenElsewhere = useMemo(() => {
        const map = {};
        worlds.forEach(w => {
            if (linking && w.id === linking.id) return;
            (w.mission_ids || []).forEach(id => { map[id] = w.name; });
        });
        return map;
    }, [worlds, linking]);

    if (loading) {
        return <div className="p-8 text-gray-400 font-medieval">Cargando mundos…</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Globe className="text-emerald-400" size={28} />
                    <div>
                        <h1 className="text-2xl font-extrabold font-medieval uppercase tracking-wider text-white">Mundos</h1>
                        <p className="text-sm text-gray-400">Agrupan misiones y definen de qué preguntas salen las Ninja Cards.</p>
                    </div>
                </div>
                <button
                    onClick={() => setEditing({ ...BLANK })}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                    <Plus size={18} /> Nuevo mundo
                </button>
            </header>

            {feedback && (
                <div className={`px-4 py-3 rounded-xl border text-sm ${feedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                    {feedback.text}
                </div>
            )}
            {error && (
                <div className="px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 text-sm">{error}</div>
            )}

            {worlds.length === 0 && (
                <div className="text-center py-16 border border-dashed border-gray-700 rounded-2xl">
                    <Globe className="mx-auto text-gray-600 mb-3" size={40} />
                    <p className="text-gray-400">Todavía no hay mundos. Las misiones existentes siguen jugándose como “misiones sueltas”.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {worlds.map(w => {
                    const health = w.pool_health || {};
                    const examOk = !w.exam_tag || health.exam_count > 0;
                    const hasFinal = !!w.final_mission_id;
                    return (
                        <div key={w.id} className="bg-gray-900/60 border border-gray-700 rounded-2xl overflow-hidden flex flex-col">
                            <div className="p-4 flex-1 flex flex-col gap-3">
                                {/* El arte es cuadrado y de baja resolución: se trata como
                                    icono junto al título, no como banner estirado. */}
                                <div className="flex items-center gap-3">
                                    {w.cover_image ? (
                                        <img src={artUrl(w.cover_image)} alt=""
                                            className="w-14 h-14 rounded-xl object-cover border border-gray-700 shrink-0" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 shrink-0">
                                            <ImageIcon size={20} />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-white text-lg truncate">{w.name}</h3>
                                        <code className="text-xs text-gray-500">{w.key}</code>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-lg bg-gray-800 text-gray-300">
                                            {w.difficulty}
                                        </span>
                                        {w.status !== 'active' && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-lg bg-red-900/80 text-red-200">
                                                inactivo
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                    {(w.challenge_tags || []).map(t => (
                                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700">{t}</span>
                                    ))}
                                </div>

                                {/* Semáforo del pool: lo más importante de la tarjeta. */}
                                <div className="text-xs space-y-1.5">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Swords size={13} />
                                        <span>{w.mission_ids?.length || 0} misiones</span>
                                        {hasFinal
                                            ? <span className="text-amber-400">· final asignada</span>
                                            : <span className="text-gray-600">· sin final</span>}
                                    </div>
                                    {w.exam_tag ? (
                                        <div className={`flex items-center gap-2 ${examOk ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {examOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                            <code>{w.exam_tag}</code>
                                            <span>· {health.exam_count ?? 0} preguntas</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <AlertTriangle size={13} /> sin tag de examen
                                        </div>
                                    )}
                                    {!examOk && (
                                        <p className="text-red-400/80 leading-snug">
                                            Ninguna pregunta lleva ese tag: el examen caería al pool global y no evaluaría nada.
                                        </p>
                                    )}
                                    <div className="text-gray-500">Pool temático: {health.normal_count ?? 0} preguntas</div>
                                </div>

                                <div className="flex gap-2 mt-auto pt-2">
                                    <button onClick={() => setEditing(w)} className="flex-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 py-2 rounded-lg transition-all">Editar</button>
                                    <button onClick={() => openLinking(w)} className="flex-1 text-sm bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-600/40 py-2 rounded-lg transition-all">Misiones</button>
                                    <button onClick={() => handleDelete(w)} className="px-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/40 rounded-lg transition-all"><Trash2 size={15} /></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal: editar mundo ───────────────────────────────────────── */}
            {editing && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 space-y-4 my-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white font-medieval uppercase">
                                {editing.id ? 'Editar mundo' : 'Nuevo mundo'}
                            </h2>
                            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Clave (no renombrar)" hint="Identificador estable, ej. mundo_1">
                                <input value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })}
                                    disabled={!!editing.id}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
                            </Field>
                            <Field label="Nombre (en inglés)">
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                            </Field>
                        </div>

                        <Field label="Descripción (en inglés)" hint="Se traduce al idioma del jugador automáticamente">
                            <textarea value={editing.description_en} onChange={e => setEditing({ ...editing, description_en: e.target.value })}
                                rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                        </Field>

                        <div className="grid grid-cols-3 gap-4">
                            <Field label="Dificultad">
                                <select value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </Field>
                            <Field label="Orden" hint="Solo presentación">
                                <input type="number" value={editing.order} onChange={e => setEditing({ ...editing, order: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                            </Field>
                            <Field label="Estado">
                                <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>
                            </Field>
                        </div>

                        <Field label="Tag del examen final" hint="Ej. final_mision_1 — las cards del mapa final salen SOLO de este pool">
                            <input value={editing.exam_tag} onChange={e => setEditing({ ...editing, exam_tag: e.target.value.trim().toLowerCase() })}
                                placeholder="final_mision_1"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono" />
                            <p className="text-xs text-gray-500 mt-1">
                                Etiqueta las preguntas con este mismo tag en <strong>Retos</strong>. No le aparece al jugador como categoría de práctica.
                            </p>
                        </Field>

                        <Field label="Pool temático (cards de las misiones normales)">
                            <TagPicker
                                value={editing.challenge_tags || []}
                                options={allTags}
                                onChange={tags => setEditing({ ...editing, challenge_tags: tags })}
                            />
                        </Field>

                        <Field label="Tipos de reto" hint="Vacío = todos">
                            <div className="flex flex-wrap gap-2">
                                {TYPES.map(ty => {
                                    const on = (editing.challenge_types || []).includes(ty);
                                    return (
                                        <button key={ty} type="button"
                                            onClick={() => setEditing({
                                                ...editing,
                                                challenge_types: on
                                                    ? editing.challenge_types.filter(x => x !== ty)
                                                    : [...(editing.challenge_types || []), ty],
                                            })}
                                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${on
                                                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                                                : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                            {ty}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        <Field
                            label="Portada (opcional)"
                            hint="Si la dejas vacía se usa la imagen del mapa de la misión final"
                        >
                            <div className="flex items-center gap-3">
                                {editing.cover_image ? (
                                    <img src={artUrl(editing.cover_image)} alt=""
                                        className="w-16 h-16 object-cover rounded-lg border border-gray-700 shrink-0" />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg border border-dashed border-gray-700 flex items-center justify-center text-gray-600 shrink-0">
                                        <ImageIcon size={20} />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        value={editing.cover_image}
                                        onChange={e => setEditing({ ...editing, cover_image: e.target.value.trim() })}
                                        placeholder="mundo_1.png"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Archivo dentro de <code className="text-gray-400">public/worlds/</code> del frontend. Cuadrada, 256–512 px.
                                    </p>
                                </div>
                            </div>
                        </Field>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                            <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl">
                                <Save size={16} /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: vincular misiones ──────────────────────────────────── */}
            {linking && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white font-medieval uppercase">Misiones de “{linking.name}”</h2>
                                <p className="text-sm text-gray-400">
                                    Marca la <strong className="text-amber-400">final</strong>: es el mapa que evalúa. Solo puede haber una.
                                </p>
                            </div>
                            <button onClick={() => setLinking(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                            {missions.map(m => {
                                const selected = selectedIds.includes(m.id);
                                const taken = takenElsewhere[m.id];
                                return (
                                    <div key={m.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selected
                                            ? 'bg-emerald-600/10 border-emerald-600/40'
                                            : taken ? 'bg-gray-900 border-gray-800 opacity-50' : 'bg-gray-800/50 border-gray-700'}`}>
                                        <input type="checkbox" checked={selected} disabled={!!taken}
                                            onChange={() => toggleMission(m.id)}
                                            className="w-4 h-4 accent-emerald-500" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white text-sm font-semibold truncate">{m.title}</div>
                                            <div className="text-xs text-gray-500">
                                                <code>{m.scene_key}</code> · {m.difficulty}
                                                {taken && <span className="text-amber-500"> · ya está en “{taken}”</span>}
                                            </div>
                                        </div>
                                        <label className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${finalId === m.id
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                            : 'text-gray-500 border border-transparent hover:text-gray-300'} ${!selected && 'opacity-30 pointer-events-none'}`}>
                                            <input type="radio" name="final" checked={finalId === m.id}
                                                onChange={() => setFinalId(m.id)} className="hidden" />
                                            <Swords size={13} /> Final
                                        </label>
                                    </div>
                                );
                            })}
                        </div>

                        {finalId === 0 && selectedIds.length > 0 && (
                            <p className="text-xs text-amber-400/80 flex items-center gap-2">
                                <AlertTriangle size={14} /> Sin misión final, este mundo no tiene examen que valide lo aprendido.
                            </p>
                        )}

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
                            <button onClick={() => setLinking(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                            <button onClick={handleSaveLinks} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl">
                                <Save size={16} /> Guardar vínculos
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Field = ({ label, hint, children }) => (
    <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
            {label}{hint && <span className="ml-2 normal-case font-normal text-gray-600">{hint}</span>}
        </label>
        {children}
    </div>
);

/** TagPicker — chips editables con sugerencias del catálogo real de retos. */
const TagPicker = ({ value, options, onChange }) => {
    const [input, setInput] = useState('');
    const suggestions = options
        .filter(o => !value.includes(o) && (!input || o.includes(input.toLowerCase())))
        .slice(0, 8);

    const add = (tag) => {
        const t = tag.trim().toLowerCase();
        if (t && !value.includes(t)) onChange([...value, t]);
        setInput('');
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {value.map(t => (
                    <span key={t} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-200 border border-emerald-600/40">
                        {t}
                        <button onClick={() => onChange(value.filter(x => x !== t))} className="hover:text-white"><X size={11} /></button>
                    </span>
                ))}
            </div>
            <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
                placeholder="Escribe un tag y Enter…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(s => (
                        <button key={s} type="button" onClick={() => add(s)}
                            className="text-xs px-2 py-1 rounded-lg bg-gray-800 text-gray-400 border border-gray-700 hover:border-emerald-600/50 hover:text-emerald-300">
                            + {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
