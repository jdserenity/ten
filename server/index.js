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

async function proxyTranslate(req, res) {
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const endpoint = String(body.endpoint || process.env.LIBRETRANSLATE_ENDPOINT || '').trim();
  if (!endpoint) return sendJson(res, 400, { error: 'Missing LibreTranslate endpoint.' });

  const payload = {
    q: String(body.q || ''),
    source: String(body.source || 'auto'),
    target: String(body.target || 'en'),
    format: String(body.format || 'text')
  };

  const apiKey = String(body.apiKey || process.env.LIBRETRANSLATE_API_KEY || '').trim();
  if (apiKey) payload.api_key = apiKey;

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    });
    res.end(text);
  } catch (error) { sendJson(res, 502, { error: `Failed to reach LibreTranslate: ${error.message}` }); }
}

async function proxyAnki(req, res) {
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const endpoint = String(body.endpoint || process.env.ANKI_CONNECT_ENDPOINT || '').trim();
  if (!endpoint) return sendJson(res, 400, { error: 'Missing AnkiConnect endpoint.' });

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
