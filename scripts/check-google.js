import 'dotenv/config';

const TRANSLATE_URL = process.env.GOOGLE_TRANSLATE_API_URL || 'https://translation.googleapis.com/language/translate/v2';
const API_KEY = String(process.env.GOOGLE_TRANSLATE_API_KEY || '').trim();

async function readError(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      const body = await response.json();
      return String(body?.error?.message || body?.error?.status || body?.message || '').trim();
    }
    return String(await response.text()).trim();
  } catch {
    return '';
  }
}

async function main() {
  if (!API_KEY) {
    throw new Error('Missing GOOGLE_TRANSLATE_API_KEY. Export it before running this check.');
  }

  const url = new URL(TRANSLATE_URL);
  url.searchParams.set('key', API_KEY);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: 'Bom dia',
      target: 'en',
      format: 'text'
    })
  });

  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(`Google Translate check failed (${response.status})${detail ? `: ${detail}` : '.'}`);
  }

  const body = await response.json();
  const translatedText = String(body?.data?.translations?.[0]?.translatedText || '').trim();
  if (!translatedText) {
    throw new Error('Google Translate response did not include translated text.');
  }

  console.log(`Google Translate OK at ${TRANSLATE_URL}`);
  console.log(`Sample translation: Bom dia -> ${translatedText}`);
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});
