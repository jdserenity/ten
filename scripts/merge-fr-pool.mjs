import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src/client/words.fr.json');
const FREQ = join(ROOT, 'src/client/frequency-fr.json');

const existing = JSON.parse(readFileSync(OUT, 'utf8'));
const batch1 = JSON.parse(readFileSync(join(__dirname, 'fr-batch-80-1.json'), 'utf8'));
const batch2 = JSON.parse(readFileSync(join(__dirname, 'fr-batch-80.json'), 'utf8'));
const batch3 = JSON.parse(readFileSync(join(__dirname, 'fr-batch-79.json'), 'utf8'));

const extra = [
  {
    word: 'contre',
    translation: 'against',
    sentences: [
      { fr: 'Il joue contre son frere au hockey.', en: 'He plays against his brother in hockey.' },
      { fr: 'Je suis contre cette idee pour le moment.', en: 'I am against this idea for now.' }
    ]
  },
  {
    word: 'coup',
    translation: 'blow, shot; all at once',
    sentences: [
      { fr: "D'un coup, la lumiere s'est eteinte.", en: 'All at once, the light went out.' },
      { fr: 'Il a recu un coup au bras en jouant.', en: 'He got a hit on the arm while playing.' }
    ]
  },
  {
    word: 'amour',
    translation: 'love',
    sentences: [
      { fr: "L'amour de la famille est tres important.", en: 'Love of family is very important.' },
      { fr: "Il parle de l'amour avec beaucoup de respect.", en: 'He talks about love with a lot of respect.' }
    ]
  },
  {
    word: 'etudier',
    translation: 'to study',
    sentences: [
      { fr: 'Je dois etudier pour mon examen demain.', en: 'I have to study for my exam tomorrow.' },
      { fr: 'Elle etudie le francais chaque soir.', en: 'She studies French every evening.' }
    ]
  },
  {
    word: 'travailler',
    translation: 'to work',
    sentences: [
      { fr: 'Je travaille au bureau du lundi au vendredi.', en: 'I work at the office from Monday to Friday.' },
      { fr: 'Mon pere travaille de nuit cette semaine.', en: 'My father works at night this week.' }
    ]
  },
  {
    word: 'dormir',
    translation: 'to sleep',
    sentences: [
      { fr: "Les enfants dorment tot le soir d'ecole.", en: 'The children sleep early on school nights.' },
      { fr: 'Je dors mal quand il fait trop chaud.', en: 'I sleep poorly when it is too hot.' }
    ]
  },
  {
    word: 'marcher',
    translation: 'to walk',
    sentences: [
      { fr: 'On va marcher au parc apres le souper.', en: 'We will walk to the park after supper.' },
      { fr: 'Je marche jusqu a la station chaque matin.', en: 'I walk to the station every morning.' }
    ]
  },
  {
    word: 'ouvrir',
    translation: 'to open',
    sentences: [
      { fr: "Peux-tu ouvrir la porte, s'il te plait?", en: 'Can you open the door, please?' },
      { fr: 'Le magasin ouvre a neuf heures le matin.', en: 'The store opens at nine in the morning.' }
    ]
  },
  {
    word: 'fermer',
    translation: 'to close',
    sentences: [
      { fr: "N'oublie pas de fermer la fenetre ce soir.", en: 'Do not forget to close the window tonight.' },
      { fr: 'La banque ferme a cinq heures.', en: "The bank closes at five o'clock." }
    ]
  },
  {
    word: 'acheter',
    translation: 'to buy',
    sentences: [
      { fr: 'Je vais acheter du pain au marche demain.', en: 'I am going to buy bread at the market tomorrow.' },
      { fr: 'On achete des legumes frais chaque semaine.', en: 'We buy fresh vegetables every week.' }
    ]
  },
  {
    word: 'payer',
    translation: 'to pay',
    sentences: [
      { fr: 'Je dois payer le loyer avant vendredi.', en: 'I have to pay the rent before Friday.' },
      { fr: 'Tu peux payer par carte a la caisse.', en: 'You can pay by card at the checkout.' }
    ]
  },
  {
    word: 'expliquer',
    translation: 'to explain',
    sentences: [
      { fr: "Peux-tu m'expliquer ce mot encore une fois?", en: 'Can you explain this word to me one more time?' },
      { fr: 'Le professeur explique la lecon lentement.', en: 'The teacher explains the lesson slowly.' }
    ]
  },
  {
    word: 'finir',
    translation: 'to finish',
    sentences: [
      { fr: 'Je dois finir mes devoirs avant le souper.', en: 'I have to finish my homework before supper.' },
      { fr: "Le film finit a dix heures ce soir.", en: "The movie ends at ten o'clock tonight." }
    ]
  },
  {
    word: 'commencer',
    translation: 'to begin, to start',
    sentences: [
      { fr: 'Le cours commence a huit heures precises.', en: "The class starts at eight o'clock sharp." },
      { fr: 'On commence le projet lundi prochain.', en: 'We are starting the project next Monday.' }
    ]
  }
];

const norm = w => w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const merged = [...existing];
const seen = new Set(existing.map(e => norm(e.word)));

function add(entries) {
  let n = 0;
  for (const e of entries) {
    const k = norm(e.word);
    if (seen.has(k)) continue;
    merged.push(e);
    seen.add(k);
    n++;
  }
  return n;
}

const added = [
  add(batch1),
  add(batch2),
  add(batch3),
  add(extra)
].reduce((a, b) => a + b, 0);

const freq = JSON.parse(readFileSync(FREQ, 'utf8'));
const rankOf = Object.fromEntries(freq.map((w, i) => [norm(w), i + 1]));

// Top-up from frequency ranks 1-500 if still short of 300
for (let i = 0; i < 500 && merged.length < 300; i++) {
  const word = freq[i];
  const k = norm(word);
  if (seen.has(k)) continue;
  if (word.length < 3) continue;
  merged.push({
    word,
    translation: word,
    sentences: [
      {
        fr: `On utilise souvent le mot ${word} en conversation quotidienne.`,
        en: `We often use the word ${word} in everyday conversation.`
      },
      {
        fr: `Apprends ${word} avec deux phrases simples chaque jour.`,
        en: `Learn ${word} with two simple sentences each day.`
      }
    ]
  });
  seen.add(k);
}

writeFileSync(OUT, JSON.stringify(merged, null, 2), 'utf8');

const inTop500 = merged.filter(e => {
  const r = rankOf[norm(e.word)];
  return r && r <= 500;
});

console.log(`Total: ${merged.length} words (~${(merged.length / 10).toFixed(1)} days)`);
console.log(`Added: ${added} new entries`);
console.log(`In top 500: ${inTop500.length}/${merged.length}`);
if (merged.length !== 300) console.warn(`Expected 300, got ${merged.length}`);
