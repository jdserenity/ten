import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = normalize(join(__dirname, '..'));
const CLIENT_DIR = join(ROOT, 'src/client');
const PORT = Number(process.env.PORT || 3001);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function normalizePathname(pathname) {
  if (pathname === '/' || pathname === '') return '/index.html';
  return pathname;
}

function getFilePath(pathname) {
  const safe = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  return join(CLIENT_DIR, safe);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function normalizeTargetLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  return code;
}

function toGoogleLanguageCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'en';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'pt';
  return code.toLowerCase();
}

function normalizeDetectedSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  return code;
}

function countWordsIgnoringPunctuation(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function chooseTranslateProvider(text) {
  const wordCount = countWordsIgnoringPunctuation(text);
  return {
    provider: wordCount <= 5 ? 'google' : 'deepl',
    wordCount
  };
}

function buildGoogleTranslateUrl(endpoint, apiKey) {
  const url = new URL(endpoint);
  url.searchParams.set('key', apiKey);
  return url.toString();
}

async function parseJsonIfPresent(responseBody, contentType) {
  if (!String(contentType || '').toLowerCase().includes('application/json')) return null;
  try {
    return JSON.parse(responseBody);
  } catch {
    return null;
  }
}

async function requestDeepLTranslation({ text, targetLang, authKey }) {
  const endpoint = String(process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate').trim();
  const payload = new URLSearchParams();
  payload.set('text', text);
  payload.set('target_lang', targetLang);

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${authKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });

  const raw = await upstream.text();
  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
  const parsedBody = await parseJsonIfPresent(raw, contentType);

  if (!upstream.ok) {
    const detail =
      String(parsedBody?.message || parsedBody?.detail || parsedBody?.error || raw || '')
        .trim()
        .slice(0, 300);
    const suffix = detail ? `: ${detail}` : '.';
    return {
      ok: false,
      statusCode: upstream.status,
      error: `DeepL request failed (${upstream.status})${suffix}`
    };
  }

  const translatedText = String(parsedBody?.translations?.[0]?.text || '').trim();
  if (!translatedText) {
    return {
      ok: false,
      statusCode: 502,
      error: 'DeepL response did not include translated text.'
    };
  }

  return {
    ok: true,
    statusCode: 200,
    body: {
      translatedText,
      detectedSourceLang: normalizeDetectedSourceLanguage(parsedBody?.translations?.[0]?.detected_source_language),
      billedCharacters: Number(parsedBody?.billed_characters) || undefined,
      modelTypeUsed: String(parsedBody?.model_type_used || '').trim() || undefined
    }
  };
}

async function requestGoogleTranslation({ text, targetLang, apiKey }) {
  const endpoint = String(process.env.GOOGLE_TRANSLATE_API_URL || 'https://translation.googleapis.com/language/translate/v2').trim();
  const upstream = await fetch(buildGoogleTranslateUrl(endpoint, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'pt-BR',
      target: toGoogleLanguageCode(targetLang),
      format: 'text'
    })
  });

  const raw = await upstream.text();
  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
  const parsedBody = await parseJsonIfPresent(raw, contentType);

  if (!upstream.ok) {
    const detail =
      String(parsedBody?.error?.message || parsedBody?.error?.status || raw || '')
        .trim()
        .slice(0, 300);
    const suffix = detail ? `: ${detail}` : '.';
    return {
      ok: false,
      statusCode: upstream.status,
      error: `Google Translate request failed (${upstream.status})${suffix}`
    };
  }

  const translation = parsedBody?.data?.translations?.[0];
  const translatedText = String(translation?.translatedText || '').trim();
  if (!translatedText) {
    return {
      ok: false,
      statusCode: 502,
      error: 'Google Translate response did not include translated text.'
    };
  }

  return {
    ok: true,
    statusCode: 200,
    body: {
      translatedText,
      detectedSourceLang: normalizeDetectedSourceLanguage(translation?.detectedSourceLanguage)
    }
  };
}

async function proxyTranslate(req, res) {
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const text = String(body.text ?? body.q ?? '').trim();
  if (!text) return sendJson(res, 400, { error: 'Missing text to translate.' });

  const targetLang = normalizeTargetLanguage(body.targetLang ?? body.target ?? 'EN');
  if (!targetLang) return sendJson(res, 400, { error: 'Missing target language.' });

  const { provider, wordCount } = chooseTranslateProvider(text);

  try {
    if (provider === 'google') {
      const apiKey = String(body.googleApiKey ?? body.googleKey ?? process.env.GOOGLE_TRANSLATE_API_KEY ?? '').trim();
      if (!apiKey) {
        return sendJson(res, 400, { error: 'Missing Google Translate API key. Set GOOGLE_TRANSLATE_API_KEY in your server environment.' });
      }

      const result = await requestGoogleTranslation({ text, targetLang, apiKey });
      if (!result.ok) return sendJson(res, result.statusCode, { error: result.error });
      return sendJson(res, 200, {
        ...result.body,
        provider,
        strategyWordCount: wordCount
      });
    }

    const authKey = String(body.authKey ?? body.apiKey ?? process.env.DEEPL_AUTH_KEY ?? '').trim();
    if (!authKey) {
      return sendJson(res, 400, { error: 'Missing DeepL auth key. Set DEEPL_AUTH_KEY in your server environment.' });
    }

    const result = await requestDeepLTranslation({ text, targetLang, authKey });
    if (!result.ok) return sendJson(res, result.statusCode, { error: result.error });
    return sendJson(res, 200, {
      ...result.body,
      provider,
      strategyWordCount: wordCount
    });
  } catch (error) {
    sendJson(res, 502, { error: `Failed to reach translation provider. Check internet access and key validity: ${error.message}` });
  }
}

async function proxyAnki(req, res) {
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const endpoint = String(process.env.ANKI_CONNECT_ENDPOINT || 'http://127.0.0.1:8765').trim();
  if (!endpoint) return sendJson(res, 400, { error: 'Missing AnkiConnect endpoint. Set ANKI_CONNECT_ENDPOINT.' });

  const payload = {
    action: String(body.action || ''),
    version: Number(body.version || 6),
    params: body.params && typeof body.params === 'object' ? body.params : {}
  };

  if (!payload.action) return sendJson(res, 400, { error: 'Missing action.' })

  try {
    const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8' });
    res.end(text);
  } catch (error) { sendJson(res, 502, { error: `Failed to reach AnkiConnect: ${error.message}` }); }
}

async function serveStatic(pathname, res) {
  const filePath = getFilePath(normalizePathname(pathname));
  if (!filePath.startsWith(CLIENT_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.byteLength });
    res.end(stat);
  } catch {
    if (pathname !== '/' && pathname !== '/index.html') return serveStatic('/', res);
    sendJson(res, 404, { error: 'Not found' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  if (pathname === '/api/translate' && req.method === 'POST') return proxyTranslate(req, res);
  if (pathname === '/api/anki' && req.method === 'POST') return proxyAnki(req, res);
  if (pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });

  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  return serveStatic(pathname, res);
});

server.listen(PORT, () => console.log(`Ten server running on http://localhost:${PORT}`) );
