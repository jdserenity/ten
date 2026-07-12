import 'dotenv/config';
import { parse } from 'node-html-parser';
import { initDb } from '../server/db.js';
import { addCard } from '../server/cards.js';

const DECKS = [
  { deck: 'Brazilian Portuguese', language: 'PT-BR' },
  { deck: 'French', language: 'FR' }
];

async function ankiInvoke(action, params) {
  const endpoint = String(process.env.ANKI_CONNECT_ENDPOINT || 'http://127.0.0.1:8765').trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AnkiConnect failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const body = await response.json();
  if (body?.error) throw new Error(body.error);
  return body.result;
}

function htmlToText(html) {
  return parse(String(html || '')).text.replace(/\s+/g, ' ').trim();
}

function splitBackAndContext(backHtml) {
  const raw = String(backHtml || '');
  const emSplit = raw.split(/<br\s*\/?>\s*<br\s*\/?>\s*<em>/i);
  if (emSplit.length < 2) return { back: htmlToText(raw), context: '' };
  const contextPart = emSplit.slice(1).join('<br><br><em>').replace(/<\/em>.*$/is, '');
  return { back: htmlToText(emSplit[0]), context: htmlToText(contextPart) };
}

function escapeDeckQuery(deck) {
  return String(deck || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function importDeck({ deck, language }) {
  const noteIds = await ankiInvoke('findNotes', { query: `deck:"${escapeDeckQuery(deck)}"` });
  if (!Array.isArray(noteIds) || !noteIds.length) {
    console.log(`No notes in deck "${deck}".`);
    return { imported: 0, skipped: 0 };
  }

  const infos = await ankiInvoke('notesInfo', { notes: noteIds });
  let imported = 0;
  let skipped = 0;

  for (const note of Array.isArray(infos) ? infos : []) {
    const fields = note?.fields && typeof note.fields === 'object' ? note.fields : {};
    const front = htmlToText(fields.Front?.value);
    const { back, context } = splitBackAndContext(fields.Back?.value || '');
    if (!front || !back) { skipped++; continue; }

    const result = addCard(language, { front, back, context });
    if (result.ok) imported++;
    else if (result.reason === 'duplicate') skipped++;
    else skipped++;
  }

  return { imported, skipped };
}

initDb();
let totalImported = 0;
let totalSkipped = 0;

for (const entry of DECKS) {
  const stats = await importDeck(entry);
  console.log(`${entry.deck}: imported ${stats.imported}, skipped ${stats.skipped}`);
  totalImported += stats.imported;
  totalSkipped += stats.skipped;
}

console.log(`Done. Imported ${totalImported}, skipped ${totalSkipped}. Scheduling starts fresh in Ten.`);
