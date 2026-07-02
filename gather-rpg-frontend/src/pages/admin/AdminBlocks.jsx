import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, ChevronDown, ChevronUp, Bell, UserX, UserCheck, RefreshCw } from 'lucide-react';
import api from '../../services/api';

/**
 * AdminBlocks — registro de bloqueos entre usuarios (moderación).
 *
 * Muestra, por usuario bloqueado: cuántas veces fue bloqueado (usuarios
 * distintos), el desglose de motivos y cada reporte individual. Desde aquí el
 * admin puede desactivar/reactivar la cuenta (expulsa y bloquea el login) o
 * enviarle una advertencia por WebSocket.
 */
export const AdminBlocks = () => {
    const { t } = useTranslation();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);   // user_id expandido
    const [notifyTarget, setNotifyTarget] = useState(null); // { user_id, username }
    const [notifyMessage, setNotifyMessage] = useState('');
    const [feedback, setFeedback] = useState(null);   // { type, text }

    const reasonLabel = (r) => t(`lobby.block.reasons.${r}`, r);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/admin/blocks');
            setBlockedUsers(res.data?.blocked_users || []);
        } catch (e) {
            setError(e?.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const flash = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 5000);
    };

    const handleToggleActive = async (u) => {
        const deactivating = u.is_active;
        const confirmMsg = deactivating
            ? t('admin.blocks.confirm_deactivate', { name: u.username, defaultValue: `¿Desactivar la cuenta de ${u.username}? Será expulsado y no podrá iniciar sesión.` })
            : t('admin.blocks.confirm_activate', { name: u.username, defaultValue: `¿Reactivar la cuenta de ${u.username}?` });
        if (!window.confirm(confirmMsg)) return;
        try {
            await api.put(`/admin/users/${u.user_id}/active`, { is_active: !deactivating });
            flash('success', deactivating
                ? t('admin.blocks.deactivated', 'Cuenta desactivada')
                : t('admin.blocks.activated', 'Cuenta reactivada'));
            load();
        } catch (e) {
            flash('error', e?.response?.data?.error || e.message);
        }
    };

    const handleSendNotify = async () => {
        if (!notifyMessage.trim()) return;
        try {
            const res = await api.post(`/admin/users/${notifyTarget.user_id}/notify`, { message: notifyMessage.trim() });
            flash('success', res.data?.delivered
                ? t('admin.blocks.notify_delivered', 'Advertencia entregada')
                : t('admin.blocks.notify_offline', 'Usuario offline: no se entregó la advertencia'));
            setNotifyTarget(null);
            setNotifyMessage('');
        } catch (e) {
            flash('error', e?.response?.data?.error || e.message);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Ban className="text-red-400" size={24} />
                    {t('admin.blocks.title', 'Registro de bloqueos')}
                </h1>
                <button
                    onClick={load}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold px-4 py-2 rounded-xl border border-white/10 transition cursor-pointer"
                >
                    <RefreshCw size={14} /> {t('admin.blocks.refresh', 'Actualizar')}
                </button>
            </div>

            {feedback && (
                <div className={`mb-4 px-4 py-2 rounded-xl text-xs font-bold ${
                    feedback.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}>{feedback.text}</div>
            )}

            {loading && <p className="text-gray-400 text-sm">{t('admin.blocks.loading', 'Cargando…')}</p>}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {!loading && !error && blockedUsers.length === 0 && (
                <p className="text-gray-500 text-sm italic">{t('admin.blocks.empty', 'Ningún usuario ha sido bloqueado todavía.')}</p>
            )}

            <div className="space-y-3">
                {blockedUsers.map(u => (
                    <div key={u.user_id} className="bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden">
                        {/* Fila resumen */}
                        <div className="flex items-center justify-between p-4 gap-4 flex-wrap">
                            <div className="flex items-center gap-3 min-w-[200px]">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${u.is_online ? 'bg-green-500' : 'bg-gray-600'}`}
                                    title={u.is_online ? 'Online' : 'Offline'} />
                                <div>
                                    <p className="text-white font-bold text-sm">{u.username}</p>
                                    <p className="text-gray-500 text-[11px]">{u.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-red-500/15 text-red-300 border border-red-500/30 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                                    {t('admin.blocks.times_blocked', { n: u.total_blocks, defaultValue: `${u.total_blocks} bloqueo(s)` })}
                                </span>
                                {Object.entries(u.reasons || {}).map(([r, n]) => (
                                    <span key={r} className="bg-white/5 text-gray-300 border border-white/10 text-[10px] px-2 py-1 rounded-lg">
                                        {reasonLabel(r)} × {n}
                                    </span>
                                ))}
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                                    u.is_active
                                        ? 'bg-green-500/10 text-green-300 border-green-500/30'
                                        : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                }`}>
                                    {u.is_active ? t('admin.blocks.account_active', 'Cuenta activa') : t('admin.blocks.account_disabled', 'Cuenta desactivada')}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setNotifyTarget({ user_id: u.user_id, username: u.username })}
                                    className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-amber-500/30 transition cursor-pointer"
                                    title={t('admin.blocks.notify', 'Notificar al usuario')}
                                >
                                    <Bell size={13} /> {t('admin.blocks.notify', 'Notificar')}
                                </button>
                                <button
                                    onClick={() => handleToggleActive(u)}
                                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                                        u.is_active
                                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                                            : 'bg-green-500/10 hover:bg-green-500/20 text-green-300 border-green-500/30'
                                    }`}
                                >
                                    {u.is_active
                                        ? (<><UserX size={13} /> {t('admin.blocks.deactivate', 'Desactivar')}</>)
                                        : (<><UserCheck size={13} /> {t('admin.blocks.activate', 'Reactivar')}</>)}
                                </button>
                                <button
                                    onClick={() => setExpanded(expanded === u.user_id ? null : u.user_id)}
                                    className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                                >
                                    {expanded === u.user_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Detalle de reportes */}
                        {expanded === u.user_id && (
                            <div className="border-t border-white/10 bg-black/30 p-4">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                                            <th className="pb-2 pr-4">{t('admin.blocks.col_blocker', 'Bloqueado por')}</th>
                                            <th className="pb-2 pr-4">{t('admin.blocks.col_reason', 'Motivo')}</th>
                                            <th className="pb-2 pr-4">{t('admin.blocks.col_details', 'Detalles')}</th>
                                            <th className="pb-2">{t('admin.blocks.col_date', 'Fecha')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {u.records.map((r, i) => (
                                            <tr key={i} className="text-xs text-gray-300 border-t border-white/5">
                                                <td className="py-2 pr-4 font-bold text-white">{r.blocker_username}</td>
                                                <td className="py-2 pr-4">{reasonLabel(r.reason)}</td>
                                                <td className="py-2 pr-4 text-gray-400 italic max-w-[280px] truncate" title={r.details}>{r.details || '—'}</td>
                                                <td className="py-2 text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal notificar */}
            {notifyTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-96 bg-gray-900 border border-amber-500/30 rounded-2xl shadow-2xl p-5">
                        <h3 className="text-amber-300 font-bold text-sm mb-3 flex items-center gap-2">
                            <Bell size={16} />
                            {t('admin.blocks.notify_title', { name: notifyTarget.username, defaultValue: `Advertencia para ${notifyTarget.username}` })}
                        </h3>
                        <textarea
                            value={notifyMessage}
                            onChange={(e) => setNotifyMessage(e.target.value)}
                            rows={3}
                            maxLength={300}
                            placeholder={t('admin.blocks.notify_placeholder', 'Ej: Has recibido reportes por mensajes inapropiados. Modera tu comportamiento o tu cuenta será desactivada.')}
                            className="w-full bg-gray-950/60 text-white text-xs px-3 py-2 border border-white/10 rounded-xl focus:border-amber-500 focus:outline-none resize-none mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setNotifyTarget(null); setNotifyMessage(''); }}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold py-2 rounded-xl border border-white/10 transition cursor-pointer"
                            >
                                {t('lobby.block.cancel', 'Cancelar')}
                            </button>
                            <button
                                onClick={handleSendNotify}
                                disabled={!notifyMessage.trim()}
                                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-xl border border-amber-500/30 transition cursor-pointer"
                            >
                                {t('admin.blocks.notify_send', 'Enviar advertencia')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
