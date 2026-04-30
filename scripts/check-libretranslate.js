const BASE_URL = process.env.LIBRETRANSLATE_BASE_URL || 'http://127.0.0.1:5000';

async function main() {
  const languagesResponse = await fetch(`${BASE_URL}/languages`);
  if (!languagesResponse.ok) {
    throw new Error(`Languages request failed (${languagesResponse.status}).`);
  }

  const languages = await languagesResponse.json();
  if (!Array.isArray(languages) || !languages.length) {
    throw new Error('No languages returned by LibreTranslate.');
  }

  const translateResponse = await fetch(`${BASE_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: 'Bom dia',
      source: 'pb',
      target: 'en',
      format: 'text'
    })
  });

  if (!translateResponse.ok) {
    throw new Error(`Translate request failed (${translateResponse.status}).`);
  }

  const translateBody = await translateResponse.json();
  const translatedText = String(translateBody?.translatedText || '').trim();
  if (!translatedText) {
    throw new Error('Translate response did not include translatedText.');
  }

  console.log(`LibreTranslate OK at ${BASE_URL}`);
  console.log(`Languages loaded: ${languages.map(lang => lang.code).join(', ')}`);
  console.log(`Sample translation: Bom dia -> ${translatedText}`);
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});
