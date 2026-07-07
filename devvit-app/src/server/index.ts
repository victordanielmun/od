/**
 * Devvit server entrypoint. Runs on Reddit's serverless infra (no host to provision). The
 * webview reaches these routes via same-origin `fetch('/api/...')`. All game state lives in
 * the managed Redis; identity is the Reddit user (see core/identity.ts).
 */
import { createServer, getServerPort, context, reddit } from '@devvit/web/server';
import { Router } from './core/http.js';
import * as learn from './services/learningService.js';
import * as missions from './services/missionService.js';
import * as npcs from './services/npcService.js';
import * as room from './services/roomService.js';
import { resolveNinjaCard } from './services/combatService.js';
import type { NinjaCardRequest } from './services/combatService.js';
import { talk, talkToNpc } from './services/dialogueService.js';
import type { DialogueRequest, NpcTalkRequest } from './services/dialogueService.js';
import { seedAll } from './seed/seed.js';
import type { EnemyState } from '../shared/realtime.js';

const router = new Router()
  .post('/internal/create-post', async () => {
    const { subredditName } = context;
    if (!subredditName) {
      throw new Error('No subredditName found in context');
    }
    await reddit.submitCustomPost({
      title: 'Odyssey RPG',
      subredditName,
      entry: 'default'
    });
    return { ok: true };
  })
  // ── Learning loop ──────────────────────────────────────────────────────────
  .get('/api/challenge/random', ({ query }) =>
    learn.getRandomForUser({
      type: query.get('type') ?? undefined,
      difficulty: query.get('difficulty') ?? undefined,
      tag: query.get('tag') ?? undefined,
    }),
  )
  .post('/api/attempt', async ({ body }) => {
    const b = await body<{ challengeId: string; selectedOption: number }>();
    return learn.submitAttempt(b.challengeId, b.selectedOption);
  })
  .get('/api/leaderboard', ({ query }) => learn.leaderboard(Number(query.get('top') ?? 20)))

  // ── Player ─────────────────────────────────────────────────────────────────
  .get('/api/me', () => learn.myBundle())
  .put('/api/me/native-language', async ({ body }) => {
    const b = await body<{ nativeLanguage: string }>();
    return learn.chooseNativeLanguage(b.nativeLanguage);
  })

  // ── Missions ─────────────────────────────────────────────────────────────────
  .get('/api/missions/scene', ({ query }) => missions.getMissionsForScene(query.get('key') ?? ''))
  .post('/api/missions/accept', async ({ body }) => {
    const b = await body<{ missionId: string }>();
    return missions.accept(b.missionId);
  })

  // ── NPC dialogue (text, via OpenAI) ──────────────────────────────────────────
  .get('/api/npc/scene', ({ query }) => npcs.listForScene(query.get('key') ?? ''))
  .post('/api/npc/dialogue', async ({ body }) => {
    const b = await body<DialogueRequest>();
    return talk(b);
  })
  .post('/api/npc/talk', async ({ body }) => {
    const b = await body<NpcTalkRequest>();
    return talkToNpc(b);
  })

  // ── Multiplayer room: presence + chat (movement is client-broadcast) ─────────
  .post('/api/room/join', async ({ body }) => {
    const b = await body<{ roomId: string }>();
    return room.join(b.roomId);
  })
  .post('/api/room/ping', async ({ body }) => {
    const b = await body<{ roomId: string }>();
    return room.ping(b.roomId);
  })
  .post('/api/room/leave', async ({ body }) => {
    const b = await body<{ roomId: string }>();
    return room.leaveRoom(b.roomId);
  })
  .post('/api/room/move', async ({ body }) => {
    const b = await body<{ roomId: string; x: number; y: number; dir: string; state: string }>();
    return room.broadcastMove(b.roomId, b.x, b.y, b.dir, b.state);
  })
  .post('/api/room/enemies', async ({ body }) => {
    const b = await body<{ roomId: string; enemies: EnemyState[] }>();
    return room.broadcastEnemies(b.roomId, b.enemies);
  })
  .get('/api/room/chat', ({ query }) => room.chatHistory(query.get('roomId') ?? ''))
  .post('/api/room/chat', async ({ body }) => {
    const b = await body<{ roomId: string; text: string }>();
    return room.sendChat(b.roomId, b.text);
  })

  // ── Combat: Ninja Card (English challenge → kill) ────────────────────────────
  .post('/api/combat/ninja-card', async ({ body }) => {
    const b = await body<NinjaCardRequest>();
    return resolveNinjaCard(b);
  })

  // ── Content seeding (dev/mod) ────────────────────────────────────────────────
  // TODO(Fase 0): expose this only via a moderator menu action, not a public route.
  .post('/api/admin/seed', ({ query }) => seedAll(query.get('force') === '1'))

  // ── Legal documents ──────────────────────────────────────────────────────────
  .get('/privacy', async ({ res }) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Privacy Policy - Odyssey RPG</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #ece3d4; background-color: #14110d; }
    h1, h2 { color: #e0a145; }
    a { color: #e0a145; }
  </style>
</head>
<body>
  <h1>Privacy Policy for Odyssey RPG</h1>
  <p>Last updated: July 6, 2026</p>
  <p>Odyssey RPG is a Reddit app developed on the Reddit Developer Platform. We value your privacy and handle your data with transparency.</p>
  <h2>1. Data Collection</h2>
  <p>Our app processes your Reddit username and Reddit User ID (provided securely via Reddit's Developer Platform APIs) to create your character and track your game statistics, progress, and language learning achievements (e.g., XP, daily streak, and level).</p>
  <h2>2. Data Usage and Storage</h2>
  <p>All user information, stats, and game progress are stored entirely inside Reddit's sandboxed Redis data store allocated specifically to this app. We do not transmit or store your personal data on any third-party external servers, except for necessary request context sent securely to the OpenAI API for dynamically generating translation and dialogue context (with no personally identifiable information).</p>
  <h2>3. Data Sharing</h2>
  <p>We do not sell, rent, or share user data with any third parties. Your data is strictly used to run the Odyssey RPG app interface and multiplayer taverns inside Reddit.</p>
  <h2>4. Contact</h2>
  <p>If you have questions or want to request data deletion, please contact the developer via Reddit private message.</p>
</body>
</html>`);
    return null;
  })
  .get('/terms', async ({ res }) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Terms of Service - Odyssey RPG</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #ece3d4; background-color: #14110d; }
    h1, h2 { color: #e0a145; }
    a { color: #e0a145; }
  </style>
</head>
<body>
  <h1>Terms of Service for Odyssey RPG</h1>
  <p>Last updated: July 6, 2026</p>
  <p>By installing, accessing, or playing Odyssey RPG inside Reddit, you agree to these Terms of Service.</p>
  <h2>1. Acceptance of Terms</h2>
  <p>You agree to comply with Reddit's User Agreement and Content Policy, in addition to these Terms.</p>
  <h2>2. Game Rules and User Conduct</h2>
  <p>Odyssey RPG is a social language learning game. You agree to interact respectfully with other players in the multiplayer tavern chat. Any form of harassment, hate speech, cheating, or disruptive behavior is strictly prohibited and will result in a ban from the game.</p>
  <h2>3. Disclaimer of Warranties</h2>
  <p>The game is provided "as is" without warranty of any kind. We do not guarantee uninterrupted or error-free operation.</p>
  <h2>4. Changes to Terms</h2>
  <p>We reserve the right to update these terms at any time. Your continued use of the game constitutes acceptance of the updated terms.</p>
</body>
</html>`);
    return null;
  });

const server = createServer(async (req, res) => {
  await router.handle(req, res);
});

server.listen(getServerPort());
