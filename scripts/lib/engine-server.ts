/**
 * API HTTP locale du moteur (MOT5, décision M3) : pour les tests et pour l'intégration de l'extension.
 *
 * - GET  /info       → informations sur le moteur et ses ressources ;
 * - POST /translate  → `{ "text": "…" }` → `{ "result": … }`
 *                      ou `{ "texts": ["…", …] }` → `{ "results": [ … ] }`.
 *   `sourceLang` ('fr' | 'auto') et `targetLang` ('eto') sont acceptés, comme dans la requête du contrat.
 *
 * Le serveur n'écoute que sur l'interface locale (voir scripts/serve-engine.ts). CORS n'est ouvert
 * qu'aux extensions Chrome et aux pages de localhost.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Engine } from '../../src/engine/engine';

export const MAX_BODY_BYTES = 1024 * 1024;
export const MAX_TEXTS = 500;
export const MAX_TEXT_LENGTH = 10_000;

const ALLOWED_ORIGIN = /^(?:chrome-extension:\/\/[a-p]{32}|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?)$/u;

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // Au-delà de la limite, le reste du corps est lu sans être gardé, pour pouvoir répondre 413.
      if (size > MAX_BODY_BYTES) reject(new HttpError(413, 'BODY_TOO_LARGE', `Corps de requête limité à ${MAX_BODY_BYTES} octets.`));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function checkText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_TEXT', `« ${field} » doit être une chaîne.`);
  if (value.length > MAX_TEXT_LENGTH) throw new HttpError(400, 'TEXT_TOO_LONG', `« ${field} » dépasse ${MAX_TEXT_LENGTH} caractères.`);
  return value;
}

/** Valide le corps de POST /translate : un texte ou une liste de textes. */
export function parseTranslateBody(raw: string): { text: string } | { texts: string[] } {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Le corps doit être du JSON.');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'INVALID_BODY', 'Le corps doit être un objet JSON.');
  const b = body as Record<string, unknown>;
  if (b.sourceLang !== undefined && b.sourceLang !== 'fr' && b.sourceLang !== 'auto') {
    throw new HttpError(400, 'UNSUPPORTED_SOURCE_LANG', 'Seul le français est traduit (sourceLang : fr ou auto).');
  }
  if (b.targetLang !== undefined && b.targetLang !== 'eto') throw new HttpError(400, 'UNSUPPORTED_TARGET_LANG', 'Seul l’éton est produit (targetLang : eto).');
  if ((b.text === undefined) === (b.texts === undefined)) throw new HttpError(400, 'INVALID_BODY', 'Donnez « text » ou « texts », pas les deux.');
  if (b.text !== undefined) return { text: checkText(b.text, 'text') };
  if (!Array.isArray(b.texts)) throw new HttpError(400, 'INVALID_BODY', '« texts » doit être une liste.');
  if (b.texts.length > MAX_TEXTS) throw new HttpError(400, 'TOO_MANY_TEXTS', `Au plus ${MAX_TEXTS} textes par requête.`);
  return { texts: b.texts.map((t, i) => checkText(t, `texts[${i}]`)) };
}

async function handle(engine: Engine, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  if (origin !== undefined && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }
  if (path === '/info') {
    if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Utilisez GET.');
    send(res, 200, engine.info());
    return;
  }
  if (path === '/translate') {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Utilisez POST.');
    const body = parseTranslateBody(await readBody(req));
    send(res, 200, 'text' in body ? { result: engine.translate(body.text) } : { results: engine.translateMany(body.texts) });
    return;
  }
  throw new HttpError(404, 'NOT_FOUND', `Route inconnue : ${path}`);
}

export function createEngineServer(engine: Engine): Server {
  return createServer((req, res) => {
    handle(engine, req, res).catch((error: unknown) => {
      if (res.headersSent) return;
      if (error instanceof HttpError) send(res, error.status, { error: error.code, message: error.message });
      else send(res, 500, { error: 'INTERNAL', message: 'Erreur interne du moteur.' });
    });
  });
}
