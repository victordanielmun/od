import api from './api';

// Billing / membership (Wompi) client.
//
// Card data is tokenized directly against Wompi with the PUBLIC key so the PAN
// never touches our backend (PCI scope stays with Wompi). We then hand the
// resulting card token to our backend, which registers the reusable payment
// source and issues the first charge.

// getBillingConfig returns { api_base, public_key, acceptance_token,
// accept_personal_auth, amount_in_cents, currency, permalink_* }.
export async function getBillingConfig() {
  const { data } = await api.get('/billing/config');
  return data;
}

export async function getBillingStatus() {
  const { data } = await api.get('/billing/status');
  return data; // { is_premium, status, tier, current_period_end, cancel_at_period_end }
}

// tokenizeCard posts the raw card fields to Wompi and returns a card token id.
// `apiBase` and `publicKey` come from getBillingConfig().
export async function tokenizeCard(apiBase, publicKey, card) {
  const res = await fetch(`${apiBase}/tokens/cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicKey}`,
    },
    body: JSON.stringify({
      number: card.number.replace(/\s+/g, ''),
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cvc: card.cvc,
      card_holder: card.card_holder,
    }),
  });
  const json = await res.json();
  if (!res.ok || json?.status !== 'CREATED' || !json?.data?.id) {
    const msg = json?.error?.messages
      ? Object.values(json.error.messages).flat().join(' ')
      : 'No se pudo validar la tarjeta';
    throw new Error(msg);
  }
  return json.data.id;
}

// subscribe registers the tokenized card on our backend and starts the membership.
export async function subscribe(cardToken) {
  const { data } = await api.post('/billing/subscribe', { card_token: cardToken });
  return data; // { status, is_premium }
}

export async function cancelSubscription() {
  const { data } = await api.post('/billing/cancel');
  return data;
}
