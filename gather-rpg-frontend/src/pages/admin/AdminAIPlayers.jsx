import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Trash2, Save, Sparkles, RefreshCw } from 'lucide-react';
import api from '../../services/api';

/**
 * AdminAIPlayers — configuración de los "jugadores con IA" (bots de charla).
 *
 * Son un tipo aparte de los NPCs y esta pantalla es aparte también, a propósito:
 * no tienen misiones, tareas ni tienda, usan los personajes de JUGADOR y hablan
 * por la misma ventana de chat que un usuario. Lo que se configura aquí es quién
 * es cada uno y cómo habla.
 *
 * Crear o borrar un bot toca también su fila espejo en `users` (la que permite
 * escribirle), pero de eso se encarga el backend: aquí solo se edita la ficha.
 */

const EMPTY_BOT = {
  username: '',
  character_id: '1',
  scene_key: 'lobby',
  personality: '',
  greeting: '',
  interaction_mode: 'text_only',
  voice_type: 'female',
  spawn_x: 0,
  spawn_y: 0,
  is_active: true,
};

const INTERACTION_MODES = [
  { value: 'text_only', label: 'Solo texto' },
  { value: 'hybrid', label: 'Texto + voz' },
  { value: 'audio_only', label: 'Solo voz' },
];

export const AdminAIPlayers = () => {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [draft, setDraft] = useState(null); // ficha en edición (nueva o existente)
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/ai-players');
      setBots(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSave = async () => {
    if (!draft?.username?.trim()) {
      flash('error', 'El bot necesita un nombre.');
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await api.put(`/admin/ai-players/${draft.id}`, draft);
        flash('success', `${draft.username} actualizado.`);
      } else {
        await api.post('/admin/ai-players', draft);
        flash('success', `${draft.username} creado.`);
      }
      setDraft(null);
      await load();
    } catch (e) {
      flash('error', e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bot) => {
    if (!window.confirm(`¿Borrar a ${bot.username}? Se borrará también su cuenta y dejará de aparecer. Para retirarlo conservando el historial, desactívalo en vez de borrarlo.`)) {
      return;
    }
    try {
      await api.delete(`/admin/ai-players/${bot.id}`);
      flash('success', `${bot.username} borrado.`);
      await load();
    } catch (e) {
      flash('error', e?.response?.data?.error || e.message);
    }
  };

  const handleSeed = async () => {
    try {
      const res = await api.post('/admin/ai-players/seed-defaults');
      const created = res.data?.created ?? 0;
      flash('success', created > 0 ? `${created} bots creados.` : 'Ya existían todos; no se creó ninguno.');
      await load();
    } catch (e) {
      flash('error', e?.response?.data?.error || e.message);
    }
  };

  const field = (key, value) => setDraft(d => ({ ...d, [key]: value }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-400" />
            Jugadores con IA
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gente simulada que pasea por el mapa y conversa por chat como un jugador más.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-sm cursor-pointer"
            title="Crea el elenco inicial. No duplica los que ya existan."
          >
            <Sparkles className="w-4 h-4" /> Crear elenco inicial
          </button>
          <button
            onClick={() => setDraft({ ...EMPTY_BOT })}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nuevo bot
          </button>
          <button onClick={load} className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded cursor-pointer" title="Recargar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${feedback.type === 'error' ? 'bg-red-900/40 text-red-200 border border-red-700' : 'bg-emerald-900/40 text-emerald-200 border border-emerald-700'}`}>
          {feedback.text}
        </div>
      )}

      {draft && (
        <div className="mb-6 p-4 bg-gray-900/60 border border-indigo-700/60 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">
            {draft.id ? `Editar a ${draft.username}` : 'Nuevo jugador con IA'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Nombre</span>
              <input
                value={draft.username}
                onChange={e => field('username', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
                placeholder="Mia"
              />
            </label>

            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Personaje</span>
              <input
                value={draft.character_id}
                onChange={e => field('character_id', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
                placeholder="1"
              />
              <span className="block text-[11px] text-gray-500 mt-1">
                Id del atlas de personajes de jugador (1, 2…). Uno inexistente deja al bot sin textura.
              </span>
            </label>

            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Escena</span>
              <input
                value={draft.scene_key}
                onChange={e => field('scene_key', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
                placeholder="lobby"
              />
            </label>

            <label className="text-sm md:col-span-3">
              <span className="block text-gray-400 mb-1">Personalidad</span>
              <textarea
                value={draft.personality}
                onChange={e => field('personality', e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 font-mono text-xs"
                placeholder="You are a cheerful traveller who loves asking people where they are from…"
              />
              <span className="block text-[11px] text-gray-500 mt-1">
                Quién es y de qué habla. En inglés, que es el idioma en el que responde.
              </span>
            </label>

            <label className="text-sm md:col-span-3">
              <span className="block text-gray-400 mb-1">Saludo</span>
              <input
                value={draft.greeting}
                onChange={e => field('greeting', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
                placeholder="Hey! Have you explored this place already?"
              />
              <span className="block text-[11px] text-gray-500 mt-1">
                Primera línea, solo la primera vez que le hablas. Vacío = espera a que hable el jugador.
              </span>
            </label>

            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Modo</span>
              <select
                value={draft.interaction_mode}
                onChange={e => field('interaction_mode', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
              >
                {INTERACTION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Voz</span>
              <select
                value={draft.voice_type}
                onChange={e => field('voice_type', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
              >
                <option value="female">Femenina</option>
                <option value="male">Masculina</option>
              </select>
            </label>

            <label className="text-sm flex items-end gap-2 pb-1.5">
              <input
                type="checkbox"
                checked={!!draft.is_active}
                onChange={e => field('is_active', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-gray-300">Activo</span>
            </label>

            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Posición X</span>
              <input
                type="number"
                value={draft.spawn_x}
                onChange={e => field('spawn_x', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
              />
            </label>

            <label className="text-sm">
              <span className="block text-gray-400 mb-1">Posición Y</span>
              <input
                type="number"
                value={draft.spawn_y}
                onChange={e => field('spawn_y', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
              />
              <span className="block text-[11px] text-gray-500 mt-1">
                En (0,0) aparece cerca de donde entran los jugadores.
              </span>
            </label>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">Cargando…</div>
      ) : error ? (
        <div className="text-red-300">{error}</div>
      ) : bots.length === 0 ? (
        <div className="p-8 text-center text-gray-400 border border-dashed border-gray-700 rounded-lg">
          No hay ningún jugador con IA configurado. Usa <strong>Crear elenco inicial</strong> para empezar con cinco.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 border-b border-gray-700">
              <tr>
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Escena</th>
                <th className="py-2 pr-3">Personaje</th>
                <th className="py-2 pr-3">Modo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Personalidad</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {bots.map(bot => (
                <tr key={bot.id} className="border-b border-gray-800 hover:bg-gray-900/40">
                  <td className="py-2 pr-3 font-medium">{bot.username}</td>
                  <td className="py-2 pr-3 text-gray-400">{bot.scene_key}</td>
                  <td className="py-2 pr-3 text-gray-400">{bot.character_id}</td>
                  <td className="py-2 pr-3 text-gray-400">
                    {INTERACTION_MODES.find(m => m.value === bot.interaction_mode)?.label || bot.interaction_mode}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={bot.is_active ? 'text-emerald-400' : 'text-gray-500'}>
                      {bot.is_active ? 'Activo' : 'Retirado'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-500 max-w-md truncate" title={bot.personality}>
                    {bot.personality || '—'}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setDraft({ ...bot })}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-xs mr-2 cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(bot)}
                      className="p-1.5 bg-red-900/40 hover:bg-red-800 border border-red-800 rounded cursor-pointer"
                      title="Borrar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAIPlayers;
