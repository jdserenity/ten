import 'dotenv/config';

const TRANSLATE_URL = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
const AUTH_KEY = String(process.env.DEEPL_AUTH_KEY || '').trim();

function deriveUsageUrl(translateUrl) {
  const url = new URL(translateUrl);
  url.pathname = url.pathname.replace(/\/translate\/?$/, '/usage');
  url.search = '';
  return url;
}

async function readError(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      const body = await response.json();
      return String(body?.message || body?.detail || body?.error || '').trim();
    }
    return String(await response.text()).trim();
  } catch {
    return '';
  }
}

async function main() {
  if (!AUTH_KEY) {
    throw new Error('Missing DEEPL_AUTH_KEY. Export it before running this check.');
  }

  const payload = new URLSearchParams();
  payload.set('text', 'Bom dia');
  payload.set('target_lang', 'EN');

  const translateResponse = await fetch(TRANSLATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${AUTH_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });

  if (!translateResponse.ok) {
    const detail = await readError(translateResponse);
    throw new Error(`DeepL translate check failed (${translateResponse.status})${detail ? `: ${detail}` : '.'}`);
  }

  const translateBody = await translateResponse.json();
  const translatedText = String(translateBody?.translations?.[0]?.text || '').trim();
  if (!translatedText) {
    throw new Error('DeepL response did not include translated text.');
  }

  const usageUrl = deriveUsageUrl(TRANSLATE_URL);
  const usageResponse = await fetch(usageUrl.toString(), {
    headers: { 'Authorization': `DeepL-Auth-Key ${AUTH_KEY}` }
  });

  if (!usageResponse.ok) {
    const detail = await readError(usageResponse);
    throw new Error(`DeepL usage check failed (${usageResponse.status})${detail ? `: ${detail}` : '.'}`);
  }

  const usageBody = await usageResponse.json();
  const used = Number(usageBody?.character_count);
  const limit = Number(usageBody?.character_limit);

  console.log(`DeepL OK at ${TRANSLATE_URL}`);
  console.log(`Sample translation: Bom dia -> ${translatedText}`);
  if (Number.isFinite(used) && Number.isFinite(limit)) {
    console.log(`Usage: ${used}/${limit} characters`);
  }
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});
