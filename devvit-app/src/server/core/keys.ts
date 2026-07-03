/**
 * Central Redis key schema. One place so the whole data layer stays consistent and the
 * eventual key layout is auditable. Convention: `entity:{id}` for records, `ix:*` for
 * index collections (modeled as sorted-sets, see redis.ts), `tr:*` for translation caches.
 */

export const keys = {
  // ── Identity / per-user state ──────────────────────────────────────────────
  userProfile: (userId: string) => `user:${userId}:profile`,
  userStats: (userId: string) => `user:${userId}:stats`,
  userLearning: (userId: string) => `user:${userId}:learning`,
  userAttempts: (userId: string) => `user:${userId}:attempts`, // list/stream of attempts
  userInventory: (userId: string) => `user:${userId}:inv`,     // hash itemId -> qty
  userBlocks: (userId: string) => `user:${userId}:blocks`,     // index of blocked userIds

  // ── Learning challenges ────────────────────────────────────────────────────
  challenge: (id: string) => `challenge:${id}`,
  ixChallengesAll: () => `ix:challenge:all`,
  ixChallengesByType: (type: string) => `ix:challenge:type:${type}`,
  ixChallengesByDifficulty: (d: string) => `ix:challenge:diff:${d}`,
  ixChallengesByTag: (tag: string) => `ix:challenge:tag:${tag}`,

  // ── Translation caches (per language) ──────────────────────────────────────
  trChallenge: (id: string, lang: string) => `tr:challenge:${id}:${lang}`,
  trMission: (id: string, lang: string) => `tr:mission:${id}:${lang}`,
  trTask: (id: string, lang: string) => `tr:task:${id}:${lang}`,

  // ── Leaderboards (sorted-sets) ─────────────────────────────────────────────
  leaderboardWeekly: (weekStart: string) => `lb:weekly:${weekStart}`,

  // ── Missions / NPC (added as those phases land) ────────────────────────────
  mission: (id: string) => `mission:${id}`,
  ixMissionsByScene: (sceneKey: string) => `ix:mission:scene:${sceneKey}`,
  progress: (userId: string, missionId: string) => `progress:${userId}:${missionId}`,
  npcDef: (id: string) => `npcdef:${id}`,
  ixNpcTemplatesByScene: (sceneKey: string) => `ix:npctmpl:scene:${sceneKey}`,
  dialogueCache: (hash: string) => `dlgcache:${hash}`,

  // ── Map config ─────────────────────────────────────────────────────────────
  mapConfig: (sceneKey: string) => `map:${sceneKey}`,

  // ── Multiplayer rooms (presence / chat) ────────────────────────────────────
  roomPresence: (roomId: string) => `room:${roomId}:presence`, // zset member=userId score=lastSeen
  roomNames: (roomId: string) => `room:${roomId}:names`,       // hash userId -> username
  roomChat: (roomId: string) => `room:${roomId}:chat`,         // capped history (zset by ts)
} as const;
