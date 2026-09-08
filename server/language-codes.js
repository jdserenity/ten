export function normalizeTargetLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  if (code === 'FR' || code === 'FR-CA') return 'FR';
  if (code === 'FR-FR') return 'FR-FR';
  if (code === 'ES-VE') return 'ES-VE';
  if (code === 'ES' || code === 'ES-AR' || code === 'ES-419') return 'ES-AR';
  return code;
}

export function normalizeSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  if (code === 'FR' || code === 'FR-CA') return 'FR';
  if (code === 'FR-FR') return 'FR-FR';
  if (code === 'ES-VE') return 'ES-VE';
  if (code === 'ES' || code === 'ES-AR' || code === 'ES-419') return 'ES-AR';
  return '';
}

export function toGoogleLanguageCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'en';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'pt-BR';
  if (code === 'FR' || code === 'FR-CA') return 'fr';
  if (code === 'FR-FR') return 'fr-FR';
  if (code === 'ES-AR') return 'es-AR';
  if (code === 'ES-VE') return 'es-VE';
  if (code === 'ES' || code === 'ES-419') return 'es';
  return code.toLowerCase();
}

export function toDeepLTargetLanguage(value) {
  const code = normalizeTargetLanguage(value);
  if (code === 'ES-AR' || code === 'ES-VE') return 'ES';
  if (code === 'FR-FR') return 'FR';
  return code;
}

export function normalizeDetectedSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PT' || code === 'PT-BR' || code === 'PT-PT' || code === 'PB') return 'PT-BR';
  if (code === 'FR' || code === 'FR-CA') return 'FR';
  if (code === 'FR-FR') return 'FR-FR';
  if (code === 'ES-VE') return 'ES-VE';
  if (code === 'ES' || code === 'ES-AR' || code === 'ES-419') return 'ES-AR';
  return code;
}
