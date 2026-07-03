/**
 * Odyssey webview. Two tabs: "Learn" (the English learning loop) and "Tavern" (multiplayer
 * presence + chat over Realtime). Vanilla TS/DOM so it always bundles; Phaser/room rendering
 * layers on top later. Talks to the Devvit server via `api`.
 */
import { api, type ClientChallenge, type AttemptResponse, type MeBundle } from './api.js';
import { h, withClick } from './dom.js';
import { mountTavern, unmountTavern } from './roomView.js';
import { mountQuests, unmountQuests } from './questView.js';
import { mountWorld, unmountWorld } from './worldView.js';

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Español' }, { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' }, { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' }, { code: 'ko', label: '한국어' }, { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' }, { code: 'ar', label: 'العربية' }, { code: 'tr', label: 'Türkçe' },
];

type Tab = 'learn' | 'quests' | 'world' | 'tavern';

interface State {
  tab: Tab;
  me?: MeBundle;
  challenge?: ClientChallenge;
  answered?: AttemptResponse;
  loading: boolean;
  error?: string;
}

const state: State = { tab: 'learn', loading: true };
const app = document.getElementById('app')!;

// ── Data actions ─────────────────────────────────────────────────────────────

async function boot() {
  try {
    state.me = await api.me();
  } catch (e) {
    state.error = (e as Error).message;
  }
  await loadChallenge();
}

async function loadChallenge() {
  state.loading = true;
  state.answered = undefined;
  state.error = undefined;
  render();
  try {
    state.challenge = await api.randomChallenge();
  } catch (e) {
    state.challenge = undefined;
    state.error = (e as Error).message;
  }
  state.loading = false;
  render();
}

async function answer(option: number) {
  if (!state.challenge || state.answered) return;
  try {
    state.answered = await api.submitAttempt(state.challenge.id, option);
    if (state.me) {
      state.me.learning.totalXp = state.answered.totalXp;
      state.me.learning.streakDays = state.answered.streakDays;
      state.me.learning.englishLevel = state.answered.englishLevel as MeBundle['learning']['englishLevel'];
    }
  } catch (e) {
    state.error = (e as Error).message;
  }
  render();
}

async function changeLanguage(code: string) {
  try {
    await api.setNativeLanguage(code);
    if (state.me) state.me.profile.nativeLanguage = code;
  } catch (e) {
    state.error = (e as Error).message;
  }
  await loadChallenge();
}

async function seed() {
  state.loading = true;
  render();
  try {
    await api.seed();
  } catch (e) {
    state.error = (e as Error).message;
  }
  await loadChallenge();
}

function setTab(tab: Tab) {
  if (tab === state.tab) return;
  if (state.tab === 'tavern') unmountTavern();
  if (state.tab === 'quests') unmountQuests();
  if (state.tab === 'world') unmountWorld();
  state.tab = tab;
  render();
}

// ── Views ────────────────────────────────────────────────────────────────────

function header(): HTMLElement {
  const me = state.me;
  const lang = me?.profile.nativeLanguage ?? 'en';

  const select = h('select', { class: 'lang' });
  for (const l of LANGUAGES) {
    const opt = h('option', { value: l.code }, l.label);
    if (l.code === lang) opt.setAttribute('selected', 'true');
    select.append(opt);
  }
  select.addEventListener('change', () => changeLanguage((select as HTMLSelectElement).value));

  return h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'brand' }, '⚔️ Odyssey'),
    h(
      'div',
      { class: 'stats' },
      h('span', { class: 'pill' }, `👤 ${me?.profile.username ?? '...'}`),
      h('span', { class: 'pill' }, `🏆 ${me?.learning.englishLevel ?? '-'}`),
      h('span', { class: 'pill' }, `✨ ${me?.learning.totalXp ?? 0} XP`),
      h('span', { class: 'pill' }, `🔥 ${me?.learning.streakDays ?? 0}`),
    ),
    select,
  );
}

function nav(): HTMLElement {
  const tab = (id: Tab, label: string) => {
    const b = h('button', { class: `tab ${state.tab === id ? 'active' : ''}` }, label);
    b.addEventListener('click', () => setTab(id));
    return b;
  };
  return h('nav', { class: 'tabs' }, tab('learn', '📖 Learn'), tab('quests', '📜 Quests'), tab('world', '🗺️ World'), tab('tavern', '🍺 Tavern'));
}

function optionButton(idx: number, text: string): HTMLElement {
  const btn = h('button', { class: 'opt' }, text);
  const answered = state.answered;
  if (answered) {
    if (idx === answered.correctOption) btn.classList.add('correct');
    else btn.classList.add('dim');
    btn.setAttribute('disabled', 'true');
  } else {
    btn.addEventListener('click', () => answer(idx));
  }
  return btn;
}

function challengeCard(): HTMLElement {
  const c = state.challenge!;
  const card = h('section', { class: 'card' });

  card.append(h('div', { class: 'badge' }, `${c.type} · ${c.difficulty}`));
  card.append(h('h2', { class: 'question' }, c.question));
  if (c.questionNative && c.nativeLang !== 'en') card.append(h('p', { class: 'native' }, c.questionNative));

  const opts = h('div', { class: 'options' });
  opts.append(optionButton(1, c.option1), optionButton(2, c.option2), optionButton(3, c.option3));
  card.append(opts);

  const a = state.answered;
  if (a) {
    const banner = h('div', { class: `result ${a.isCorrect ? 'good' : 'bad'}` });
    banner.append(h('strong', {}, a.isCorrect ? '✓ Correct!' : '✗ Not quite'));
    banner.append(h('span', {}, ` +${a.xpGained} XP`));
    if (a.leveledUp) banner.append(h('span', { class: 'levelup' }, ' · LEVEL UP! 🎉'));
    if (!a.isCorrect && c.explanationNative) banner.append(h('p', { class: 'native' }, c.explanationNative));
    card.append(banner);
    card.append(withClick(h('button', { class: 'next' }, 'Next →'), loadChallenge));
  }
  return card;
}

function emptyState(): HTMLElement {
  const box = h('section', { class: 'card empty' });
  box.append(h('p', {}, state.error ?? 'No challenges yet.'));
  box.append(withClick(h('button', { class: 'next' }, 'Seed starter content'), seed));
  return box;
}

async function renderLeaderboard(el: HTMLElement) {
  try {
    const rows = await api.leaderboard(10);
    el.replaceChildren(h('h3', {}, '🏅 Weekly Leaderboard'));
    if (rows.length === 0) el.append(h('p', { class: 'muted' }, 'Be the first to score this week!'));
    for (const r of rows) {
      el.append(h('div', { class: 'lb-row' }, h('span', {}, `#${r.rank} ${r.username}`), h('span', {}, `${r.score}`)));
    }
  } catch {
    el.replaceChildren(h('p', { class: 'muted' }, 'Leaderboard unavailable.'));
  }
}

function renderLearn(): HTMLElement {
  const main = h('main', { class: 'layout' });
  if (state.loading) main.append(h('section', { class: 'card' }, 'Loading…'));
  else if (state.challenge) main.append(challengeCard());
  else main.append(emptyState());

  const lb = h('aside', { class: 'leaderboard' });
  main.append(lb);
  void renderLeaderboard(lb);
  return main;
}

function render() {
  app.replaceChildren(header(), nav());

  if (state.tab === 'learn') {
    app.append(renderLearn());
  } else if (state.tab === 'quests') {
    const content = h('div', { class: 'content' });
    app.append(content);
    void mountQuests(content);
  } else if (state.tab === 'world') {
    const content = h('div', { class: 'content' });
    app.append(content);
    void mountWorld(content);
  } else {
    const content = h('div', { class: 'content' });
    app.append(content);
    void mountTavern(content);
  }
}

boot();
