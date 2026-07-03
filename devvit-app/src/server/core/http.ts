/**
 * Minimal JSON router over Devvit's Node-http-compatible `createServer`. Kept dependency-free
 * (no Express) and tiny — just enough for the webview to `fetch('/api/...')`. Routes are
 * matched by method + exact path; query params are parsed for the handler.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  query: URLSearchParams;
  body: <T>() => Promise<T>;
}

export type Handler = (ctx: Ctx) => Promise<unknown>;

type Route = { method: string; path: string; handler: Handler };

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: Handler) {
    this.routes.push({ method: 'GET', path, handler });
    return this;
  }
  post(path: string, handler: Handler) {
    this.routes.push({ method: 'POST', path, handler });
    return this;
  }
  put(path: string, handler: Handler) {
    this.routes.push({ method: 'PUT', path, handler });
    return this;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = this.routes.find((r) => r.method === (req.method ?? 'GET') && r.path === url.pathname);

    if (!route) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ctx: Ctx = {
      req,
      res,
      query: url.searchParams,
      body: <T>() => readJson<T>(req),
    };

    try {
      const result = await route.handler(ctx);
      sendJson(res, 200, result ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
      } else {
        console.error('[http] unhandled error:', err);
        sendJson(res, 500, { error: 'Internal error' });
      }
    }
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
