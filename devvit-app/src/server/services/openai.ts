/**
 * OpenAI client — called DIRECTLY from the Devvit server via the global `fetch` (Devvit
 * routes it because `api.openai.com` is in devvit.json http.domains). No external gateway.
 *
 * The API key and model come from Devvit app settings/secrets (`settings.get`), never from
 * code or the bundle. Set them with `devvit settings set openai-api-key`.
 */
import { settings } from '@devvit/web/server';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

async function apiKey(): Promise<string> {
  const key = await settings.get<string>('openai-api-key');
  if (!key) throw new Error('OpenAI API key not configured (devvit settings set openai-api-key)');
  return key;
}

async function model(): Promise<string> {
  return (await settings.get<string>('openai-model')) || DEFAULT_MODEL;
}

interface ChatOptions {
  temperature?: number;
  /** When true, ask the model for a strict JSON object response. */
  json?: boolean;
}

/** Low-level chat call. Returns the assistant message content as a string. */
export async function chat(systemPrompt: string, userPrompt: string, opts: ChatOptions = {}): Promise<string> {
  const [key, mdl] = await Promise.all([apiKey(), model()]);

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: mdl,
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Chat call that expects (and parses) a JSON object response. */
export async function chatJSON<T>(systemPrompt: string, userPrompt: string, temperature = 0.4): Promise<T> {
  const raw = await chat(systemPrompt, userPrompt, { json: true, temperature });
  return JSON.parse(extractJSON(raw)) as T;
}

/** Pull the first {...} block out of a response that may include prose or code fences. */
export function extractJSON(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}
