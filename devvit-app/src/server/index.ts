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
  .post('/api/admin/seed', ({ query }) => seedAll(query.get('force') === '1'));

const server = createServer(async (req, res) => {
  await router.handle(req, res);
});

server.listen(getServerPort());
