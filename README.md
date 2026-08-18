# Ten

Phone PWA: Brazilian Portuguese, Quebec French, France French, Argentinian Spanish.

```bash
cp .env.example .env    # GOOGLE_TRANSLATE_API_KEY, DEEPL_AUTH_KEY
npm install
npm run start           # http://localhost:3001 (scans up if busy)
npm test
```

Optional: `PORT`, `TEN_DB_PATH` (default `data/ten.db`). Keys and other env notes: `.env.example`.

```bash
npm run words:check              # dialect word-pool gate
npm run frequency:download       # refresh bundled frequency JSON
npm run deepl:check / google:check
npm run import:anki              # one-shot; needs Anki Desktop + AnkiConnect
```

Word-pool editorial rules: `scaffold/skills/seed-daily-words/SKILL.md`.
