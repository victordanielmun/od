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
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Política de Privacidad - Odyssey RPG</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 40px 20px;
      color: #ece3d4;
      background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
    }
    .container {
      max-width: 800px;
      width: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
    }
    .header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-weight: 900;
      font-size: 28px;
      margin: 0;
      background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      color: #fbbf24;
      margin-top: 30px;
      margin-bottom: 15px;
      border-left: 3px solid #d97706;
      padding-left: 10px;
    }
    p {
      font-size: 14px;
      color: #9ca3af;
      margin: 0 0 15px 0;
    }
    a {
      color: #fbbf24;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    a:hover {
      color: #f59e0b;
      text-decoration: underline;
    }
    ul, ol {
      font-size: 14px;
      color: #9ca3af;
      padding-left: 20px;
      margin-bottom: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .back-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #9ca3af;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .back-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #fbbf24;
      color: #ffffff;
    }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .tab {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #9ca3af;
      border: 1px solid transparent;
      transition: all 0.2s;
      text-decoration: none;
    }
    .tab:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
    .tab.active {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.1);
      border-color: rgba(251, 191, 36, 0.3);
    }
    .footer-print {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      margin-top: 30px;
      padding-top: 20px;
      font-size: 11px;
      color: #4b5563;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="#" onclick="window.history.length > 1 ? window.history.back() : window.location.href='/'" class="back-btn">
      ← Volver
    </a>
    
    <div class="header">
      <h1>Odyssey RPG</h1>
      <p style="margin-top: 5px;">Aviso Legal y Normativas de la Comunidad</p>
    </div>

    <div class="tabs">
      <a href="/terms" class="tab">Términos de Servicio</a>
      <a href="/privacy" class="tab active">Política de Privacidad</a>
    </div>

    <div class="space-y-6">
      <p style="font-size: 11px; font-family: monospace;">Última actualización: 6 de julio, 2026 · Versión 1.0</p>
      
      <p>En <strong>Odyssey RPG</strong> ("Odisea"), nos comprometemos profundamente con la privacidad y transparencia de sus datos personales. Esta Política de Privacidad describe cómo recopilamos, almacenamos y procesamos su información en cumplimiento estricto de la <strong>Ley Estatutaria 1581 de 2012</strong> (Colombia), el <strong>Decreto Reglamentario 1377 de 2013</strong> (Habeas Data) y demás normas de protección de datos.</p>
      
      <h2>1. Datos que Recopilamos</h2>
      <p>Recopilamos la información mínima necesaria para el correcto funcionamiento del juego, incluyendo:</p>
      <ul>
        <li><strong>Información de Registro:</strong> Nombre, apellidos y dirección de correo electrónico.</li>
        <li><strong>Número de WhatsApp:</strong> Únicamente si decide vincular voluntariamente las notificaciones del bot del juego.</li>
        <li><strong>Progreso en la Plataforma:</strong> Puntuaciones, streaks diarios, nivel de inglés, vocabulario aprendido y estadísticas de juego.</li>
        <li><strong>Grabaciones de Voz:</strong> Archivos de audio temporales generados al utilizar la herramienta de reconocimiento de pronunciación.</li>
      </ul>

      <h2>2. Integración con Reddit y Procesamiento Técnico</h2>
      <p>Odyssey RPG está integrado con la plataforma de desarrollo de Reddit. Cuando accede a través de ella:</p>
      <ul>
        <li>Procesamos de forma segura su Reddit Username e ID de usuario para crear y sincronizar su perfil de personaje y logros.</li>
        <li>La base de datos se almacena en el almacenamiento Redis aislado y seguro de Reddit asignado a nuestra aplicación.</li>
        <li><strong>Conexión con OpenAI API:</strong> Para la generación inteligente de misiones y diálogos interactivos de traducción, enviamos solicitudes seguras a la API de OpenAI. Estas solicitudes contienen únicamente contexto temático de juego y <strong>nunca transmiten información personal identificable (PII)</strong> del usuario.</li>
      </ul>

      <h2>3. Finalidad del Tratamiento de Datos</h2>
      <p>Los datos recopilados se utilizarán exclusivamente para personalizar y optimizar la experiencia de aprendizaje y gamificación dentro de Odisea, gestionar el sistema multijugador y enviar recordatorios o alertas a través de WhatsApp (solo si está expresamente autorizado por usted).</p>

      <h2>4. Compartición de Datos</h2>
      <p>Sus datos personales no serán vendidos, alquilados ni transferidos a terceros. Únicamente se podrán compartir datos en circunstancias excepcionales bajo requerimientos judiciales explícitos o con proveedores de infraestructura técnica (alojamiento en la nube) vinculados a estrictos acuerdos de confidencialidad.</p>

      <h2>5. Derechos del Usuario (Habeas Data)</h2>
      <p>Usted cuenta con los derechos de conocer, actualizar, rectificar y solicitar la supresión de sus datos de nuestros servidores en cualquier momento. Para ejercer estos derechos, por favor contáctenos a: <a href="mailto:support@odisea-rpg.com">support@odisea-rpg.com</a>.</p>
    </div>

    <div class="footer-print">
      <span>© 2026 Odyssey RPG. Todos los derechos reservados.</span>
      <span>Contacto: support@odisea-rpg.com</span>
    </div>
  </div>
</body>
</html>`);
    return null;
  })
  .get('/terms', async ({ res }) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Términos de Servicio - Odyssey RPG</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 40px 20px;
      color: #ece3d4;
      background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
    }
    .container {
      max-width: 800px;
      width: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
    }
    .header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-weight: 900;
      font-size: 28px;
      margin: 0;
      background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      color: #fbbf24;
      margin-top: 30px;
      margin-bottom: 15px;
      border-left: 3px solid #d97706;
      padding-left: 10px;
    }
    p {
      font-size: 14px;
      color: #9ca3af;
      margin: 0 0 15px 0;
    }
    a {
      color: #fbbf24;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    a:hover {
      color: #f59e0b;
      text-decoration: underline;
    }
    ul, ol {
      font-size: 14px;
      color: #9ca3af;
      padding-left: 20px;
      margin-bottom: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .back-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #9ca3af;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .back-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #fbbf24;
      color: #ffffff;
    }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .tab {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #9ca3af;
      border: 1px solid transparent;
      transition: all 0.2s;
      text-decoration: none;
    }
    .tab:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
    .tab.active {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.1);
      border-color: rgba(251, 191, 36, 0.3);
    }
    .warning-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 12px;
      padding: 16px;
      margin: 20px 0;
      font-size: 13px;
      color: #fef08a;
    }
    .footer-print {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      margin-top: 30px;
      padding-top: 20px;
      font-size: 11px;
      color: #4b5563;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="#" onclick="window.history.length > 1 ? window.history.back() : window.location.href='/'" class="back-btn">
      ← Volver
    </a>
    
    <div class="header">
      <h1>Odyssey RPG</h1>
      <p style="margin-top: 5px;">Aviso Legal y Normativas de la Comunidad</p>
    </div>

    <div class="tabs">
      <a href="/terms" class="tab active">Términos de Servicio</a>
      <a href="/privacy" class="tab">Política de Privacidad</a>
    </div>

    <div class="space-y-6">
      <p style="font-size: 11px; font-family: monospace;">Última actualización: 6 de julio, 2026 · Versión 1.0</p>
      
      <p>Bienvenido a <strong>Odyssey RPG</strong> (o "Odisea"), una plataforma de aprendizaje de inglés gamificada. Al registrarse, acceder o jugar en la plataforma, usted acepta cumplir en su totalidad con los presentes Términos de Servicio. Si no está de acuerdo con alguna disposición, debe abstenerte de usar la plataforma.</p>

      <div class="warning-box">
        <strong>⚠️ Restricción de Edad — Solo Mayores de 18 Años</strong><br/>
        Odisea es una plataforma diseñada exclusivamente para mayores de 18 años. Al registrarse, usted declara bajo la gravedad de juramento que tiene 18 años o más al momento del registro, que la información suministrada es veraz y que comprende que el acceso a menores está prohibido. Odyssey se reserva el derecho de eliminar permanentemente cualquier cuenta infractora.
      </div>

      <h2>1. Aceptación de los Términos</h2>
      <p>Al registrarte en Odisea, confirmas que has leído, comprendido y aceptas los presentes términos. Estos regulan el acceso, el chat multijugador, y las mecánicas de aprendizaje asociadas.</p>

      <h2>2. Comunicaciones por WhatsApp</h2>
      <p>El envío de mensajes, recordatorios y contenido de inglés a través de WhatsApp es completamente opcional y requiere su autorización expresa. Puedes activarlo o desactivarlo en cualquier momento desde tu cuenta, o darte de baja respondiendo "STOP". Sus datos no se compartirán.</p>

      <h2>3. Entorno Multijugador y Responsabilidad</h2>
      <p>Las interacciones entre jugadores son responsabilidad de cada usuario individualmente. Odyssey no se hace responsable por comentarios u ofensas de terceros. Contamos con un sistema de reporte anónimo en el juego para sancionar conductas inapropiadas, acoso o trampas. Reportes manuales: <a href="mailto:support@odisea-rpg.com">support@odisea-rpg.com</a>.</p>

      <h2>4. Limitación de Responsabilidad</h2>
      <p>El juego se proporciona "tal cual", sin garantías. Odyssey no garantiza que el funcionamiento sea 100% ininterrumpido o libre de errores temporales.</p>

      <h2>5. Modificaciones</h2>
      <p>Nos reservamos el derecho de actualizar estos términos en cualquier momento. El uso continuado del juego tras la publicación de los cambios constituye aceptación de los mismos.</p>
    </div>

    <div class="footer-print">
      <span>© 2026 Odyssey RPG. Todos los derechos reservados.</span>
      <span>Contacto: support@odisea-rpg.com</span>
    </div>
  </div>
</body>
</html>`);
    return null;
  });

const server = createServer(async (req, res) => {
  await router.handle(req, res);
});

server.listen(getServerPort());
