import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addFeedback,
  addUnlockedWord,
  addUserLanguages,
  findOrCreateUser,
  getAllUnlockedWords,
  getCachedTranslation,
  getDailyCardIndex,
  getDailyWordAssignment,
  getFeedbackList,
  getUserById,
  getUserLanguages,
  importUnlockedWords,
  initDb,
  setCachedTranslation,
  setDailyCardIndex,
  setDailyWordAssignment,
  setUserAppLang,
  setUserLanguages
} from './db.js';
import { addCard, answerCard, deleteCard, getReviewQueue, updateCard } from './cards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = normalize(join(__dirname, '..'));
const CLIENT_DIR = join(ROOT, 'src/client');
const BASE_PORT = Number(process.env.PORT || 3001);
const MAX_PORT_SCAN_ATTEMPTS = 100;

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
}

function resolveRequestUser(req) {
  const raw = String(req.headers['x-user-id'] || '').trim();
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return getUserById(userId);
}

function requireUser(req, res) {
  const user = resolveRequestUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Missing or invalid user. Log in first.' });
    return null;
  }
  return user;
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    isDev: user.isDev,
    languages: getUserLanguages(user.id),
    appLang: user.appLang || null
  };
}

function normalizeTargetLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
  return code;
}

function normalizeSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
  return '';
}

function toGoogleLanguageCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'en';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'pt-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'fr';
  return code.toLowerCase();
}

function normalizeDetectedSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
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

async function requestGoogleTranslation({ text, sourceLang, targetLang, apiKey }) {
  const endpoint = String(process.env.GOOGLE_TRANSLATE_API_URL || 'https://translation.googleapis.com/language/translate/v2').trim();
  const payload = {
    q: text,
    target: toGoogleLanguageCode(targetLang),
    format: 'text'
  };
  if (sourceLang) payload.source = toGoogleLanguageCode(sourceLang);
  const upstream = await fetch(buildGoogleTranslateUrl(endpoint, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
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
  const sourceLang = normalizeSourceLanguage(body.sourceLang ?? body.source ?? '');

  const cached = getCachedTranslation(sourceLang || '', targetLang, text);
  if (cached) {
    return sendJson(res, 200, {
      translatedText: cached,
      detectedSourceLang: sourceLang || undefined,
      provider: 'cache',
      strategyWordCount: countWordsIgnoringPunctuation(text)
    });
  }

  const { provider, wordCount } = chooseTranslateProvider(text);

  try {
    if (provider === 'google') {
      const apiKey = String(body.googleApiKey ?? body.googleKey ?? process.env.GOOGLE_TRANSLATE_API_KEY ?? '').trim();
      if (!apiKey) {
        return sendJson(res, 400, { error: 'Missing Google Translate API key. Set GOOGLE_TRANSLATE_API_KEY in your server environment.' });
      }

      const result = await requestGoogleTranslation({ text, sourceLang, targetLang, apiKey });
      if (!result.ok) return sendJson(res, result.statusCode, { error: result.error });
      setCachedTranslation(sourceLang || '', targetLang, text, result.body.translatedText);
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
    setCachedTranslation(sourceLang || '', targetLang, text, result.body.translatedText);
    return sendJson(res, 200, {
      ...result.body,
      provider,
      strategyWordCount: wordCount
    });
  } catch (error) {
    sendJson(res, 502, { error: `Failed to reach translation provider. Check internet access and key validity: ${error.message}` });
  }
}

function handleUnlockedWordsGet(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  return sendJson(res, 200, { wordsByLanguage: getAllUnlockedWords(user.id) });
}

async function handleUnlockedWordsPost(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const language = String(body.language || '').trim();
  const word = String(body.word || '').trim();
  if (!language || !word) {
    return sendJson(res, 400, { error: 'Missing language or word.' });
  }

  const result = addUnlockedWord(user.id, language, word);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid language or word.' });
  return sendJson(res, 200, { ok: true, added: result.added });
}

async function handleUnlockedWordsImport(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const wordsByLanguage = body.wordsByLanguage;
  if (!wordsByLanguage || typeof wordsByLanguage !== 'object') {
    return sendJson(res, 400, { error: 'Missing wordsByLanguage object.' });
  }

  const { imported } = importUnlockedWords(user.id, wordsByLanguage);
  return sendJson(res, 200, { ok: true, imported, wordsByLanguage: getAllUnlockedWords(user.id) });
}

function handleDailyProgressGet(req, url, res) {
  const user = requireUser(req, res);
  if (!user) return;
  const language = String(url.searchParams.get('language') || '').trim();
  const dateKey = String(url.searchParams.get('dateKey') || '').trim();
  if (!language || !dateKey) {
    return sendJson(res, 400, { error: 'Missing language or dateKey.' });
  }
  const cardIndex = getDailyCardIndex(user.id, language, dateKey);
  res.setHeader('Cache-Control', 'no-store');
  return sendJson(res, 200, { cardIndex });
}

async function handleDailyProgressPost(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const language = String(body.language || '').trim();
  const dateKey = String(body.dateKey || '').trim();
  const cardIndex = body.cardIndex;
  if (!language || !dateKey || cardIndex === undefined || cardIndex === null) {
    return sendJson(res, 400, { error: 'Missing language, dateKey, or cardIndex.' });
  }

  const result = setDailyCardIndex(user.id, language, dateKey, cardIndex);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid daily progress payload.' });
  return sendJson(res, 200, { ok: true, cardIndex: result.cardIndex });
}

function handleDailyWordsGet(req, url, res) {
  const user = requireUser(req, res);
  if (!user) return;
  const language = String(url.searchParams.get('language') || '').trim();
  const dateKey = String(url.searchParams.get('dateKey') || '').trim();
  if (!language || !dateKey) {
    return sendJson(res, 400, { error: 'Missing language or dateKey.' });
  }
  const words = getDailyWordAssignment(user.id, language, dateKey);
  res.setHeader('Cache-Control', 'no-store');
  return sendJson(res, 200, { words: words || [] });
}

async function handleDailyWordsPost(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const language = String(body.language || '').trim();
  const dateKey = String(body.dateKey || '').trim();
  const words = body.words;
  if (!language || !dateKey || !Array.isArray(words)) {
    return sendJson(res, 400, { error: 'Missing language, dateKey, or words.' });
  }

  const result = setDailyWordAssignment(user.id, language, dateKey, words);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid daily words payload.' });
  return sendJson(res, 200, { ok: true, words: result.words });
}

async function handleCardsQueueGet(req, url, res) {
  const user = requireUser(req, res);
  if (!user) return;
  const language = String(url.searchParams.get('language') || '').trim();
  if (!language) return sendJson(res, 400, { error: 'Missing language.' });
  const result = getReviewQueue(user.id, language);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid language.' });
  res.setHeader('Cache-Control', 'no-store');
  return sendJson(res, 200, { cards: result.cards, totalCount: result.totalCount });
}

async function handleCardsPost(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const language = String(body.language || '').trim();
  const front = String(body.front || '').trim();
  const back = String(body.back || '').trim();
  const context = String(body.context || '').trim();
  if (!language || !front || !back) {
    return sendJson(res, 400, { error: 'Missing language, front, or back.' });
  }

  const result = addCard(user.id, language, { front, back, context });
  if (!result.ok && result.reason === 'duplicate') {
    return sendJson(res, 409, { error: 'Card already exists for this language.' });
  }
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid card payload.' });
  return sendJson(res, 200, { ok: true, id: result.id });
}

async function handleCardAnswerPost(req, res, cardId) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const rating = String(body.rating || '').trim().toLowerCase();
  if (!rating) return sendJson(res, 400, { error: 'Missing rating.' });

  const result = answerCard(user.id, cardId, rating);
  if (!result.ok && result.reason === 'not_found') {
    return sendJson(res, 404, { error: 'Card not found.' });
  }
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid rating.' });
  return sendJson(res, 200, { ok: true, id: result.id });
}

function handleCardDelete(req, res, cardId) {
  const user = requireUser(req, res);
  if (!user) return;
  const result = deleteCard(user.id, cardId);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid card id.' });
  if (!result.deleted) return sendJson(res, 404, { error: 'Card not found.' });
  return sendJson(res, 200, { ok: true });
}

async function handleCardPatch(req, res, cardId) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const front = String(body.front || '').trim();
  const back = String(body.back || '').trim();
  const context = body.context === undefined ? undefined : String(body.context || '').trim();
  if (!front || !back) {
    return sendJson(res, 400, { error: 'Missing front or back.' });
  }

  const result = updateCard(user.id, cardId, { front, back, context });
  if (!result.ok && result.reason === 'not_found') {
    return sendJson(res, 404, { error: 'Card not found.' });
  }
  if (!result.ok && result.reason === 'duplicate') {
    return sendJson(res, 409, { error: 'Card already exists for this language.' });
  }
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid card payload.' });
  return sendJson(res, 200, { ok: true, id: result.id });
}

async function handleAuthLogin(req, res) {
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const username = String(body.username || '').trim();
  if (!username) return sendJson(res, 400, { error: 'Missing username.' });

  const result = findOrCreateUser(username);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid username. Use letters, numbers, _ or -.' });
  return sendJson(res, 200, serializeUser(result));
}

function handleMeGet(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  return sendJson(res, 200, serializeUser(user));
}

async function handleAppLanguagePut(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const appLang = String(body.appLang || '').trim();
  if (!appLang) return sendJson(res, 400, { error: 'Missing app language.' });

  const result = setUserAppLang(user.id, appLang);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid app language.' });
  const updated = getUserById(user.id);
  return sendJson(res, 200, { ok: true, appLang: updated.appLang });
}

async function handleUserLanguagesPut(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const languages = body.languages;
  if (!Array.isArray(languages)) return sendJson(res, 400, { error: 'Missing languages array.' });

  const replace = body.replace === true;
  const result = replace
    ? setUserLanguages(user.id, languages)
    : addUserLanguages(user.id, languages);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid languages payload.' });
  return sendJson(res, 200, { ok: true, languages: result.languages });
}

async function handleFeedbackPost(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  let body;
  try { body = await readJsonBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid JSON body.' }); }

  const text = String(body.body || '').trim();
  if (!text) return sendJson(res, 400, { error: 'Missing feedback text.' });

  const result = addFeedback(user.id, text);
  if (!result.ok) return sendJson(res, 400, { error: 'Invalid feedback.' });
  return sendJson(res, 200, { ok: true, id: result.id });
}

function handleFeedbackGet(req, res) {
  const user = requireUser(req, res);
  if (!user) return;
  if (!user.isDev) return sendJson(res, 403, { error: 'Feedback list is only available in dev mode.' });
  return sendJson(res, 200, { feedback: getFeedbackList() });
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
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.byteLength,
      'Cache-Control': 'no-cache'
    });
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
  if (pathname === '/api/auth/login' && req.method === 'POST') return handleAuthLogin(req, res);
  if (pathname === '/api/me' && req.method === 'GET') return handleMeGet(req, res);
  if (pathname === '/api/app-language' && req.method === 'PUT') return handleAppLanguagePut(req, res);
  if (pathname === '/api/user-languages' && req.method === 'PUT') return handleUserLanguagesPut(req, res);
  if (pathname === '/api/feedback' && req.method === 'POST') return handleFeedbackPost(req, res);
  if (pathname === '/api/feedback' && req.method === 'GET') return handleFeedbackGet(req, res);

  if (pathname === '/api/cards/queue' && req.method === 'GET') return handleCardsQueueGet(req, url, res);
  if (pathname === '/api/cards' && req.method === 'POST') return handleCardsPost(req, res);

  const cardAnswerMatch = pathname.match(/^\/api\/cards\/(\d+)\/answer$/);
  if (cardAnswerMatch && req.method === 'POST') {
    return handleCardAnswerPost(req, res, Number(cardAnswerMatch[1]));
  }

  const cardDeleteMatch = pathname.match(/^\/api\/cards\/(\d+)$/);
  if (cardDeleteMatch && req.method === 'DELETE') {
    return handleCardDelete(req, res, Number(cardDeleteMatch[1]));
  }
  if (cardDeleteMatch && req.method === 'PATCH') {
    return handleCardPatch(req, res, Number(cardDeleteMatch[1]));
  }

  if (pathname === '/api/unlocked-words' && req.method === 'GET') return handleUnlockedWordsGet(req, res);
  if (pathname === '/api/unlocked-words' && req.method === 'POST') return handleUnlockedWordsPost(req, res);
  if (pathname === '/api/unlocked-words/import' && req.method === 'POST') {
    return handleUnlockedWordsImport(req, res);
  }
  if (pathname === '/api/daily-progress' && req.method === 'GET') {
    return handleDailyProgressGet(req, url, res);
  }
  if (pathname === '/api/daily-progress' && req.method === 'POST') {
    return handleDailyProgressPost(req, res);
  }
  if (pathname === '/api/daily-words' && req.method === 'GET') {
    return handleDailyWordsGet(req, url, res);
  }
  if (pathname === '/api/daily-words' && req.method === 'POST') {
    return handleDailyWordsPost(req, res);
  }
  if (pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });

  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  return serveStatic(pathname, res);
});

function listenWithPortFallback(startPort, attemptsLeft = MAX_PORT_SCAN_ATTEMPTS) {
  const port = Number.isFinite(startPort) ? startPort : 3001;
  server.once('error', error => {
    if (error && error.code === 'EADDRINUSE' && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use. Trying ${nextPort}...`);
      listenWithPortFallback(nextPort, attemptsLeft - 1);
      return;
    }
    throw error;
  });

  server.listen(port, () => console.log(`Ten server running on http://localhost:${port}`));
}

initDb();
listenWithPortFallback(BASE_PORT);
