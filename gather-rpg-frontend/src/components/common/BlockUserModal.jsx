import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, X } from 'lucide-react';

// Motivos de bloqueo — deben coincidir con ValidBlockReasons del backend.
export const BLOCK_REASONS = [
    'inappropriate_name',
    'inappropriate_message',
    'harassment',
    'spam',
    'other',
];

/**
 * BlockUserModal — selector de motivo para bloquear a un usuario.
 * Al confirmar, el bloqueado desaparece para el bloqueador (jugadores, chat,
 * audio, invitaciones) y el reporte queda registrado para el panel de admin.
 */
export const BlockUserModal = ({ target, onConfirm, onClose }) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState('inappropriate_message');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    if (!target) return null;

    const reasonLabel = (r) => t(`lobby.block.reasons.${r}`, r);

    const handleConfirm = async () => {
        // 'otro' exige detalle para que el registro del admin sea útil.
        if (reason === 'other' && !details.trim()) {
            setError(t('lobby.block.details_required', 'Describe el motivo del bloqueo'));
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onConfirm(reason, details.trim());
            onClose();
        } catch (e) {
            setError(e?.response?.data?.error || t('lobby.block.error', 'No se pudo bloquear al usuario'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className="w-80 bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-red-400 font-bold text-sm flex items-center gap-2">
                        <Ban size={16} />
                        {t('lobby.block.title', 'Bloquear usuario')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer"><X size={16} /></button>
                </div>

                <p className="text-gray-300 text-xs mb-4">
                    {t('lobby.block.subtitle', '¿Por qué quieres bloquear a')}{' '}
                    <span className="text-white font-bold">{target.username}</span>?
                </p>

                <div className="space-y-2 mb-4">
                    {BLOCK_REASONS.map(r => (
                        <label key={r} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-xs ${
                            reason === r
                                ? 'bg-red-500/10 border-red-500/40 text-red-200'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}>
                            <input
                                type="radio"
                                name="block-reason"
                                value={r}
                                checked={reason === r}
                                onChange={() => setReason(r)}
                                className="accent-red-500"
                            />
                            {reasonLabel(r)}
                        </label>
                    ))}
                </div>

                <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={t('lobby.block.details_placeholder', 'Detalles (opcional)')}
                    rows={2}
                    maxLength={300}
                    className="w-full bg-gray-950/60 text-white text-xs px-3 py-2 border border-white/10 rounded-xl focus:border-red-500 focus:outline-none resize-none mb-3"
                />

                {error && <p className="text-red-400 text-[10px] font-bold mb-3">{error}</p>}

                <p className="text-gray-500 text-[10px] mb-4">
                    {t('lobby.block.effect', 'Dejarás de ver a este usuario y de recibir sus mensajes, llamadas e invitaciones.')}
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold py-2 rounded-xl border border-white/10 transition cursor-pointer"
                    >
                        {t('lobby.block.cancel', 'Cancelar')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={submitting}
                        className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl border border-red-500/30 transition cursor-pointer"
                    >
                        {submitting ? '…' : t('lobby.block.confirm', 'Bloquear')}
                    </button>
                </div>
            </div>
        </div>
    );
};
