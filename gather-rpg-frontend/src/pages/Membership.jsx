import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown, Check, Lock, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getBillingConfig, tokenizeCard, subscribe, cancelSubscription } from '../services/billing';

// Membership / premium subscription page. Cards are tokenized directly against
// Wompi (public key) so the PAN never reaches our backend; we only send the
// resulting token to /billing/subscribe.
export function Membership() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isGuest = useAuthStore(s => s.isGuest());
  const isPremium = useAuthStore(s => s.isPremium);
  const subscription = useAuthStore(s => s.subscription);
  const fetchBillingStatus = useAuthStore(s => s.fetchBillingStatus);

  const [config, setConfig] = useState(null);
  const [card, setCard] = useState({ number: '', card_holder: '', exp_month: '', exp_year: '', cvc: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchBillingStatus();
    getBillingConfig().then(setConfig).catch(() => setConfig(null));
  }, [fetchBillingStatus]);

  const price = config
    ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: config.currency || 'COP', maximumFractionDigits: 0 })
        .format((config.amount_in_cents || 0) / 100)
    : '';

  const formatDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(i18n.language); } catch { return ''; }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setError(null);
    if (!config) { setError(t('membership.error_generic')); return; }
    setSubmitting(true);
    try {
      const token = await tokenizeCard(config.api_base, config.public_key, card);
      await subscribe(token);
      await fetchBillingStatus();
      setSuccess(true);
    } catch (err) {
      setError(err?.message || t('membership.error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('membership.cancel_confirm'))) return;
    setSubmitting(true);
    try {
      await cancelSubscription();
      await fetchBillingStatus();
    } catch {
      setError(t('membership.error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const benefits = [
    t('membership.benefit_missions'),
    t('membership.benefit_content'),
    t('membership.benefit_support'),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
          <ArrowLeft size={16} /> {t('membership.back')}
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 mb-4">
            <Crown size={32} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold">{t('membership.title')}</h1>
          <p className="text-gray-400 mt-2">{t('membership.subtitle')}</p>
        </div>

        <div className="bg-gray-900/70 border border-gray-800 rounded-3xl p-6 mb-6">
          {config && (
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-4xl font-extrabold text-amber-400">{price}</span>
              <span className="text-gray-400">{t('membership.price_suffix')}</span>
            </div>
          )}
          <ul className="space-y-3">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-200">
                <Check size={18} className="text-emerald-400 shrink-0" /> {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Already a member */}
        {isPremium ? (
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-3xl p-6 text-center">
            <ShieldCheck size={40} className="text-emerald-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-emerald-300">{t('membership.active_title')}</h2>
            {subscription?.current_period_end && (
              <p className="text-gray-300 mt-2">
                {subscription?.cancel_at_period_end
                  ? t('membership.cancel_scheduled', { date: formatDate(subscription.current_period_end) })
                  : t('membership.renews_on', { date: formatDate(subscription.current_period_end) })}
              </p>
            )}
            {!subscription?.cancel_at_period_end && (
              <button onClick={handleCancel} disabled={submitting}
                className="mt-5 text-sm text-red-400 hover:text-red-300 underline disabled:opacity-50">
                {t('membership.cancel_cta')}
              </button>
            )}
          </div>
        ) : success ? (
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-3xl p-6 text-center">
            <ShieldCheck size={40} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-emerald-300 font-semibold">{t('membership.success')}</p>
          </div>
        ) : isGuest ? (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-3xl p-6 text-center text-amber-200 flex items-center justify-center gap-3">
            <Lock size={20} /> {t('membership.guest_blocked')}
          </div>
        ) : (
          /* Card form */
          <form onSubmit={handleSubscribe} className="bg-gray-900/70 border border-gray-800 rounded-3xl p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">{t('membership.card_number')}</label>
              <input inputMode="numeric" autoComplete="cc-number" required value={card.number}
                onChange={e => setCard({ ...card, number: e.target.value })}
                placeholder="4242 4242 4242 4242"
                className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">{t('membership.card_holder')}</label>
              <input autoComplete="cc-name" required value={card.card_holder}
                onChange={e => setCard({ ...card, card_holder: e.target.value })}
                className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-amber-500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">{t('membership.exp_month')}</label>
                <input inputMode="numeric" required maxLength={2} value={card.exp_month}
                  onChange={e => setCard({ ...card, exp_month: e.target.value })}
                  placeholder="08"
                  className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">{t('membership.exp_year')}</label>
                <input inputMode="numeric" required maxLength={2} value={card.exp_year}
                  onChange={e => setCard({ ...card, exp_year: e.target.value })}
                  placeholder="28"
                  className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">{t('membership.cvc')}</label>
                <input inputMode="numeric" required maxLength={4} value={card.cvc}
                  onChange={e => setCard({ ...card, cvc: e.target.value })}
                  placeholder="123"
                  className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-amber-500" />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" disabled={submitting || !config}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">
              {submitting ? <><Loader2 size={18} className="animate-spin" /> {t('membership.processing')}</>
                          : <><Crown size={18} /> {t('membership.subscribe_cta')}</>}
            </button>
            <p className="text-[11px] text-gray-500 text-center flex items-center justify-center gap-1">
              <ShieldCheck size={13} /> {t('membership.pay_with')}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default Membership;
