# Architecture (human-readable)

What Ten is, how the pieces fit, and how to run it. Confirmed facts only. Dense agent detail lives in `scaffold/ARCH-LLM.md`. Lessons/traps live in `scaffold/PROJECT-KNOWLEDGE.md`. Word-pool editorial rules live in `scaffold/skills/seed-daily-words/SKILL.md`.

## What it is

**Ten** — a phone-first web app (PWA) for learning **Brazilian Portuguese**, **Quebec French**, **France French**, and **Argentinian Spanish**. Each person signs in with a username (no password). You study 10 words a day, translate anything, review flashcards with built-in spaced repetition, and track which frequency-list words you've unlocked.

```
  Phone                         VPS or always-on host
    │                                    │
    ▼                                    ▼
 Ten in browser  ──────HTTP──────►  Node server
 (vanilla JS PWA)                      │
                                       ├── static files (src/client)
                                       ├── /api/auth/login ──► users (SQLite)
                                       ├── /api/translate ──► Google (1–5 words) or DeepL (6+)
                                       ├── /api/cards ──────► FSRS + per-user SQLite flashcards
                                       └── SQLite (users, unlocks, daily progress, cards, feedback)
```

## Main tabs

| Tab | What you see |
| --- | --- |
| **10/day** | Up to ten words per day from words you have not surfaced yet, with translations and example sentences. Words unlocked elsewhere (Translate or Frequency) never appear here, even if they are still in the pool. Remembers which card you were on. Words you skip stay in the pool. Footer counts down remaining pool days (can show fractions like 26.4). Confetti once when you finish the tenth (per language per day). Opens first on refresh unless you already finished today. `+` saves word or sentences as flashcards. |
| **Review** | Review **10 flashcards** per day with progress dots, confetti on the 10th, then **∞** to keep going. Edit cards in place. Again / Hard / Good / Easy grades update FSRS scheduling in SQLite. Opens on refresh when 10/day is done but review is not. |
| **Frequency** | Bundled top-frequency lists. Unlocked words light up green. **Unlocked** and **Not learned** summary cards filter the list (tap again to show all). Tap a word for an inline translation. |
| **Translate** | Type text; short inputs use Google Translate, longer ones use DeepL. Save as a flashcard; hear TTS. Single-word lookups also unlock that word on the Frequency tab and show rank when known. Last tab; opens on refresh when both 10/day and review are done for today. |
| **Settings** | Cog icon in the header tools row (with feedback and flags) opens a panel: username, **app language** (English / Português), add languages (`+`), sign out. Dev account (`jd`) also sees a wrench **Ops** link (pool runway + feedback inbox). |

Sign in with a username on first open. New users pick languages via header `+` (multi-select); after that, flags show on the right and `+` moves to Settings. In Settings, the same language picker shows your current languages already selected — tap to deselect and Save to remove them. Header **feedback** field expands for beta notes.

Language switch (Brazil / Quebec / France / Argentina) is top-right — only languages you've added. The Ops page and 10/day pool-days footer appear only for the dev account.

## How the system is built

One small Node server does everything: serves the PWA files, proxies translate APIs, and stores flashcards + FSRS state.

| Piece | Job |
| --- | --- |
| `src/client/` | The whole UI (HTML/CSS/JS). No React or build step. |
| `server/index.js` | Serves files + `/api/*`. |
| `server/db.js` | SQLite: unlocks, daily 10/day position, flashcards. |
| `server/fsrs.js` | FSRS scheduling via `ts-fsrs`. |
| `src/client/words.*.json` | Daily word pools — one file per language flavour (agent-curated). |
| `src/client/frequency-*.json` | Static frequency dictionaries. |

## Run it locally

```bash
cd /path/to/ten
cp .env.example .env    # set GOOGLE_TRANSLATE_API_KEY and DEEPL_AUTH_KEY
npm install
npm run start           # http://localhost:3001 by default (scans up if busy)
npm test
npm run deepl:check
npm run google:check
```

## Production (VPS or always-on machine)

Needs: Ten's Node server running, internet for translate APIs, and the two API keys. No Anki required after migration.

**Phone access:** open `http://<your-host>:3001` (or use Tailscale to reach a home server privately).

**Keep it running (launchd on macOS):** example plist at `~/Library/LaunchAgents/com.ten.app.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ten.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd /path/to/ten && npm run start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ten.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ten.err.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.ten.app.plist
```

**After code updates:** `git pull && npm install`, then restart the service if needed.

**Back up** `data/ten.db` (or whatever `TEN_DB_PATH` points at) — unlocks, daily progress, and all flashcards live there.

**Migrating from Anki (one time):** while Anki Desktop + AnkiConnect still run on your Mac, `npm run import:anki`. Card text is copied; review scheduling starts fresh in Ten.
