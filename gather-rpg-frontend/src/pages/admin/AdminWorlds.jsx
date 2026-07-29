import { useState, useEffect, useCallback, useMemo } from 'react';
import { Globe, Plus, Trash2, Save, X, Swords, AlertTriangle, CheckCircle2, Image as ImageIcon, ChevronDown, ChevronRight } from 'lucide-react';
import api, { worldArtUrl } from '../../services/api';

/**
 * AdminWorlds — mundos: agrupan misiones y deciden de qué pool salen las Ninja Cards.
 *
 * Un mundo NO bloquea nada: todos los mundos y todas sus misiones se juegan en
 * cualquier orden. Lo que valida el aprendizaje es su MISIÓN FINAL, un mapa de
 * combate cuyas cards salen exclusivamente del `exam_tag`. Si el jugador no sabe,
 * falla las cards, el boss se cura y no puede terminar el mapa.
 *
 * Todo se edita en UN solo formulario —datos, imagen, misiones y cuál es la
 * final— porque partirlo en dos modales obligaba a adivinar que la misión final
 * se marcaba en otro sitio.
 */

const BLANK = {
    key: '', name: '', description_en: '', order: 0,
    challenge_tags: [], challenge_types: [], exam_tag: '',
    difficulty: 'beginner', cover_image: '', status: 'active',
};

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const TYPES = ['vocabulary', 'grammar', 'pronunciation', 'listening'];
/** Tipos de misión que pelean: solo estos pueden funcionar como examen. */
const COMBAT_TYPES = ['defeat_enemy', 'kill_all', 'kill_boss'];

const artUrl = worldArtUrl;

/** Convierte un nombre en una clave estable: "La Granja" → "la_granja". */
const slugify = (s) => s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // fuera acentos (marcas combinantes)
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const AdminWorlds = () => {
    const [worlds, setWorlds] = useState([]);
    const [missions, setMissions] = useState([]);
    const [images, setImages] = useState([]);   // archivos de public/worlds
    const [allTags, setAllTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [saving, setSaving] = useState(false);

    // Un único estado de edición: el mundo, sus misiones y cuál es la final.
    const [editing, setEditing] = useState(null);
    const [missionIds, setMissionIds] = useState([]);
    const [finalId, setFinalId] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const flash = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 6000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [wRes, mRes, imgRes] = await Promise.all([
                api.get('/admin/worlds'),
                api.get('/admin/missions'),
                // Galería de public/worlds del frontend. Si el backend no puede
                // leer la carpeta devuelve [], y queda el campo de texto manual.
                api.get('/admin/world-images').catch(() => ({ data: [] })),
            ]);
            setWorlds(wRes.data || []);
            setMissions(mRes.data || []);
            setImages(imgRes.data || []);
        } catch (e) {
            setError(e?.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        api.get('/learning/challenges/metadata')
            .then(res => setAllTags(res.data?.tags || []))
            .catch(() => setAllTags([]));
    }, []);

    // ── Abrir / cerrar el editor ─────────────────────────────────────────────

    const openNew = () => {
        setEditing({ ...BLANK });
        setMissionIds([]);
        setFinalId(0);
        setShowAdvanced(false);
    };

    const openEdit = (w) => {
        setEditing({ ...w });
        setMissionIds(w.mission_ids || []);
        setFinalId(w.final_mission_id || 0);
        setShowAdvanced(false);
    };

    const closeEditor = () => setEditing(null);

    // ── Guardar: mundo + vínculos, en una sola acción ────────────────────────

    const handleSave = async () => {
        if (!editing.name?.trim()) {
            flash('error', 'El nombre es obligatorio');
            return;
        }

        // La clave y el tag de examen se derivan del nombre: son identificadores
        // internos y escribirlos a mano solo servía para equivocarse (un tag mal
        // tecleado deja el examen sin preguntas, en silencio).
        const key = editing.key?.trim() || slugify(editing.name);
        const examTag = editing.exam_tag?.trim() || `final_mision_${key}`;

        setSaving(true);
        try {
            const payload = {
                ...editing,
                key,
                exam_tag: examTag,
                order: Number(editing.order) || 0,
            };

            let worldId = editing.id;
            if (worldId) {
                await api.put(`/admin/worlds/${worldId}`, payload);
            } else {
                const res = await api.post('/admin/worlds', payload);
                worldId = res.data?.id;
            }

            if (worldId) {
                await api.put(`/admin/worlds/${worldId}/missions`, {
                    mission_ids: missionIds,
                    final_mission_id: finalId,
                });
            }

            flash('success', editing.id ? 'Mundo actualizado' : 'Mundo creado');
            closeEditor();
            load();
        } catch (e) {
            flash('error', e?.response?.data?.error || e.message);
        } finally {
            setSaving(false);
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

    const toggleMission = (id) => {
        setMissionIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            // Si se descarta la que era final, el mundo se queda sin examen.
            if (!next.includes(finalId)) setFinalId(0);
            return next;
        });
    };

    // Misiones que ya pertenecen a OTRO mundo: se deshabilitan para no robarlas
    // sin querer (una misión pertenece a un solo mundo).
    const takenElsewhere = useMemo(() => {
        const map = {};
        worlds.forEach(w => {
            if (editing && w.id === editing.id) return;
            (w.mission_ids || []).forEach(id => { map[id] = w.name; });
        });
        return map;
    }, [worlds, editing]);

    const selectedMissions = missions.filter(m => missionIds.includes(m.id));
    const finalMission = missions.find(m => m.id === finalId);
    const finalIsCombat = finalMission && COMBAT_TYPES.includes(finalMission.type);

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
                    onClick={openNew}
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
                                            : <span className="text-red-400">· sin final</span>}
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
                                    <button onClick={() => openEdit(w)} className="flex-1 text-sm bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-600/40 py-2 rounded-lg transition-all">
                                        Editar
                                    </button>
                                    <button onClick={() => handleDelete(w)} className="px-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/40 rounded-lg transition-all">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Editor único: datos + imagen + misiones + final + preguntas ── */}
            {editing && (
                <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl z-10">
                            <h2 className="text-xl font-bold text-white font-medieval uppercase">
                                {editing.id ? `Editar ${editing.name}` : 'Nuevo mundo'}
                            </h2>
                            <button onClick={closeEditor} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-7">
                            {/* 1 ─ DATOS */}
                            <Section n={1} title="Datos">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Nombre (en inglés)">
                                        <input value={editing.name}
                                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                                            placeholder="The Farm"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                    </Field>
                                    <Field label="Dificultad">
                                        <select value={editing.difficulty}
                                            onChange={e => setEditing({ ...editing, difficulty: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                                            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </Field>
                                </div>

                                <Field label="Descripción (en inglés)" hint="se traduce sola al idioma del jugador">
                                    <textarea value={editing.description_en}
                                        onChange={e => setEditing({ ...editing, description_en: e.target.value })}
                                        rows={2}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                </Field>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Orden" hint="solo presentación">
                                        <input type="number" value={editing.order}
                                            onChange={e => setEditing({ ...editing, order: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
                                    </Field>
                                    <Field label="Estado">
                                        <select value={editing.status}
                                            onChange={e => setEditing({ ...editing, status: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                                            <option value="active">active</option>
                                            <option value="inactive">inactive</option>
                                        </select>
                                    </Field>
                                </div>
                            </Section>

                            {/* 2 ─ IMAGEN */}
                            <Section n={2} title="Imagen del mundo" subtitle="La que ve el jugador en el tablero del maestro">
                                {images.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-52 overflow-y-auto p-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                                            {images.map(img => {
                                                const on = editing.cover_image === img;
                                                return (
                                                    <button key={img} type="button" title={img}
                                                        onClick={() => setEditing({ ...editing, cover_image: on ? '' : img })}
                                                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${on ? 'border-emerald-500 ring-2 ring-emerald-500/40' : 'border-gray-700 hover:border-gray-500'}`}>
                                                        <img src={artUrl(img)} alt={img} className="w-full h-full object-cover" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1.5">
                                            {editing.cover_image
                                                ? <>Seleccionada: <code className="text-emerald-400">{editing.cover_image}</code> · púlsala otra vez para quitarla</>
                                                : 'Ninguna seleccionada.'}
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-sm text-amber-400/90 bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
                                        No hay imágenes en <code>gather-rpg-frontend/public/worlds/</code>. Añade PNG cuadrados ahí
                                        (y súbelos con un <code>git push</code>) para poder elegirlos.
                                    </div>
                                )}
                            </Section>

                            {/* 3 ─ MISIONES */}
                            <Section n={3} title="Misiones del mundo" subtitle={`${missionIds.length} seleccionadas`}>
                                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                                    {missions.length === 0 && (
                                        <p className="text-sm text-gray-500">No hay misiones creadas todavía.</p>
                                    )}
                                    {missions.map(m => {
                                        const selected = missionIds.includes(m.id);
                                        const taken = takenElsewhere[m.id];
                                        const combat = COMBAT_TYPES.includes(m.type);
                                        return (
                                            <label key={m.id}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${selected
                                                    ? 'bg-emerald-600/10 border-emerald-600/40'
                                                    : taken ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-gray-800/50 border-gray-700'}`}>
                                                <input type="checkbox" checked={selected} disabled={!!taken}
                                                    onChange={() => toggleMission(m.id)}
                                                    className="w-4 h-4 accent-emerald-500" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white text-sm font-semibold truncate">{m.title}</div>
                                                    <div className="text-xs text-gray-500">
                                                        <code>{m.scene_key}</code> · {m.type}
                                                        {combat && <span className="text-amber-400"> · combate</span>}
                                                        {taken && <span className="text-amber-500"> · ya está en “{taken}”</span>}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </Section>

                            {/* 4 ─ MISIÓN FINAL */}
                            <Section n={4} title="Misión final" subtitle="La que aprueba el mundo al vencer al boss">
                                <select
                                    value={finalId}
                                    onChange={e => setFinalId(Number(e.target.value))}
                                    disabled={selectedMissions.length === 0}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-40"
                                >
                                    <option value={0}>— Sin misión final —</option>
                                    {selectedMissions.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.title} ({m.type})
                                        </option>
                                    ))}
                                </select>

                                {selectedMissions.length === 0 && (
                                    <p className="text-xs text-gray-500 mt-1.5">Marca antes alguna misión en el paso 3.</p>
                                )}
                                {finalId === 0 && selectedMissions.length > 0 && (
                                    <p className="text-xs text-amber-400/90 mt-1.5 flex items-center gap-1.5">
                                        <AlertTriangle size={13} /> Sin misión final este mundo no tiene examen: nunca se marcará como aprobado.
                                    </p>
                                )}
                                {finalMission && !finalIsCombat && (
                                    <p className="text-xs text-red-400 mt-1.5 flex items-start gap-1.5">
                                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                        <span>
                                            <strong>{finalMission.title}</strong> es de tipo <code>{finalMission.type}</code>, no de combate.
                                            El mundo se aprueba al caer un boss, así que con esta misión no podrá aprobarse nunca.
                                        </span>
                                    </p>
                                )}
                                {finalMission && finalIsCombat && (
                                    <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1.5">
                                        <CheckCircle2 size={13} />
                                        Las cards del mapa <code>{finalMission.scene_key}</code> saldrán del pool de examen.
                                        Su mapa debe tener un enemigo de tipo <strong>boss</strong>.
                                    </p>
                                )}
                            </Section>

                            {/* 5 ─ PREGUNTAS */}
                            <Section n={5} title="Preguntas" subtitle="De dónde salen las Ninja Cards">
                                <Field label="Pool temático" hint="para las misiones de combate normales del mundo">
                                    <TagPicker
                                        value={editing.challenge_tags || []}
                                        options={allTags}
                                        onChange={tags => setEditing({ ...editing, challenge_tags: tags })}
                                    />
                                </Field>

                                <button type="button"
                                    onClick={() => setShowAdvanced(v => !v)}
                                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mt-3">
                                    {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Avanzado
                                </button>

                                {showAdvanced && (
                                    <div className="mt-3 space-y-4 border-l-2 border-gray-800 pl-4">
                                        <Field label="Clave" hint={editing.id ? 'no se puede cambiar' : 'se genera del nombre'}>
                                            <input value={editing.key}
                                                onChange={e => setEditing({ ...editing, key: slugify(e.target.value) })}
                                                disabled={!!editing.id}
                                                placeholder={slugify(editing.name || '') || 'la_granja'}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm disabled:opacity-50" />
                                        </Field>

                                        <Field label="Tag del examen" hint="se genera solo; cámbialo únicamente si ya etiquetaste retos con otro">
                                            <input value={editing.exam_tag}
                                                onChange={e => setEditing({ ...editing, exam_tag: e.target.value.trim().toLowerCase() })}
                                                placeholder={`final_mision_${editing.key || slugify(editing.name || '') || 'clave'}`}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm" />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Los retos se asocian a este tag desde <strong>Retos</strong>. No le aparece al jugador como categoría.
                                            </p>
                                        </Field>

                                        <Field label="Tipos de reto" hint="vacío = todos">
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
                                    </div>
                                )}
                            </Section>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-gray-800 sticky bottom-0 bg-gray-900 rounded-b-2xl">
                            <button onClick={closeEditor} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl">
                                <Save size={16} /> {saving ? 'Guardando…' : 'Guardar mundo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Section = ({ n, title, subtitle, children }) => (
    <section>
        <div className="flex items-baseline gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-600/50 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
            {subtitle && <span className="text-xs text-gray-500">— {subtitle}</span>}
        </div>
        <div className="space-y-3 pl-8">{children}</div>
    </section>
);

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
