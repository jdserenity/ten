---
name: seed-daily-words
description: >-
  Curate or refill Ten 10/day word pools for a language flavour (PT-BR, FR-CA,
  FR-FR, ES-AR). Use when adding words, seeding days of cards, fixing pool
  quality, or when the user asks to generate/expand vocabulary for daily study.
  Agent/LLM writing only — no Tatoeba or scrape generators.
---

# Seed 10/day word pools

## When to use

Read this skill before adding or rewriting entries in any `src/client/words.*.json` pool.

## Pool files (one flavour each)

| Mode | File | Sentence key | Level | Frequency source |
| --- | --- | --- | --- | --- |
| `pt-br` | `src/client/words.pt-br.json` | `pt` | Intermediate (B1–B2) | Prefer intermediate vocab; frequency-pt-br is reference only |
| `fr` (Quebec) | `src/client/words.fr-ca.json` | `fr` | Beginner (A1-ish) | `frequency-fr.json` top-down, after skip list |
| `fr-fr` (France) | `src/client/words.fr-fr.json` | `fr` | Beginner (A1-ish) | `frequency-fr.json` top-down, after skip list |
| `es-ar` | `src/client/words.es-ar.json` | `es` | Beginner (A1-ish) | `frequency-es-ar.json` top-down, after skip list |

Never share one JSON file across flavours. Quebec and France French are separate pools.

## Headword rules

- **One lemma per card** — dictionary form only: infinitive for verbs; singular (and masculine singular when gendered) for nouns/adjectives. Do not add a second card for a conjugation or plural of a lemma already in the pool.
- **Content words only** — nouns, verbs, adjectives, adverbs with real teaching value. No glue/function words as headwords (articles, personal/clitic pronouns, prepositions, conjunctions, pure auxiliaries/copulas used only as grammar, question particles, etc.). Frequency lists start with glue; **skip those** and take the next content lemmas.
- **Good variety** across a batch (mix nouns / verbs / adjectives).
- Prefer forms that are not identical to common English spellings when a better synonym exists (*animal*, *hotel*, *natural* make weak cards).

### Skip list (never use as headword)

Apply for every flavour (and the local equivalents): articles; subject/object/clitic pronouns; possessive determiners; demonstratives used only as grammar; prepositions; coordinating/subordinating conjunctions; negation particles; fillers like *oui/non/sí/no* alone; standalone relative pronouns.

Examples of banned headwords: *je, tu, il, le, la, de, et, que, yo, vos* (as pronoun headword), *tú, el, la, de, que, no, o, a, um, uma, de, que, não*.

`vos` may appear **inside ES-AR sentences** (required for flavour); it must not be the headword.

## Sense rules

- Gloss real usage in one concise line. If the lemma has **two meaningfully different common senses**, note both (e.g. *combinar* → arrange/agree; also match).
- When multi-sense, the **three sentences should showcase those senses** (at least one sentence per major sense worth teaching).
- Sentences must demonstrate the **taught** sense and part of speech — never a proper-noun reading of an adjective/noun (*linda* = beautiful, not “Linda went to the market”), never a wrong POS.

## Sentences

- **Exactly 3** example sentences per card.
- Each sentence uses a **real conjugated/inflected shape** of the lemma (or the lemma itself). Prefer **different shapes** across the three (e.g. infinitive / present / past; singular / plural) so the learner sees the word in use — without making those shapes separate cards.
- Length **20–140 characters** per learning-language sentence.
- Natural English glosses (not word-for-word calques).
- Correct orthography including **accents/diacritics** (French, Spanish, Portuguese). ASCII-only French/Spanish is a hard fail.

## Regional flavour (mandatory)

- **ES-AR:** Rioplatense. Use **voseo** (`vos tenés`, `querés`, etc.), not default *tú/tienes*. Local vocab when it is the normal word (*remera*, *colectivo*, *laburo* where natural) — do not force slang into every line.
- **FR-FR:** Metropolitan France French spelling and usage. No Quebecisms.
- **FR-CA:** Natural Quebec French where it differs; still correct French orthography.
- **PT-BR:** Brazilian Portuguese only (not European spellings: *fato* not *facto*, *ônibus* not *autocarro*).

## Entry format

```json
{
  "word": "sossego",
  "translation": "peace and quiet, calm",
  "sentences": [
    { "pt": "Preciso de um pouco de sossego para terminar esse trabalho.", "en": "I need a bit of peace and quiet to finish this work." },
    { "pt": "No fim de semana, só quero sossego e nada mais.", "en": "On the weekend, all I want is peace and quiet." },
    { "pt": "Depois da festa a casa voltou ao sossego.", "en": "After the party the house went back to peace and quiet." }
  ]
}
```

Use `fr` or `es` instead of `pt` for those pools.

## Workflow

1. Pick content lemmas from the flavour’s frequency list (skip glue).
2. Write translation + 3 flavour-correct sentences with natural English.
3. Write or append to the target pool file (append when extending; replace only when asked).
4. Run `npm run words:check` and fix every error.
5. Commit the pool (and checker/docs if you changed them).

### Pool size hint

| Words | Approx. days of 10/day |
| --- | --- |
| 50 | ~5 days |
| 200 | ~20 days |
| 365 | ~1 year |

Dev footer `~N days left in <mode> pool` (amber at ≤7) signals when to add more.

## Quality gate

`npm run words:check` validates all dialect pools. Do not ship pool edits that fail it.

Legacy **PT-BR** entries may still have 2 sentences and softer checker rules until that pool is re-seeded; **new** PT cards must have 3 and pass the same strict rules as other flavours. FR-CA, FR-FR, and ES-AR always require exactly 3.

## Do not

- Use Tatoeba, Wiktionary scrape scripts, or any auto sentence-fetch pipeline for pool text.
- Put Quebec and France (or any two flavours) in one file.
- Add glue words or duplicate lemmas / conjugations of an existing lemma.
