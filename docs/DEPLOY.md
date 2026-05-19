# Deploying

## Production target

This app runs on your always-on backup MacBook (effectively 24/7):

- Anki Desktop running continuously
- AnkiConnect enabled in Anki
- Ten Node server running continuously
- Internet access for translation API requests
- A Google Translate API key (for short inputs)
- A DeepL API Free key (for longer inputs)

## One-time setup on backup MacBook

### 1) Install dependencies

```bash
cd /path/to/ten
npm install
```

### 2) Ensure Anki + AnkiConnect are available

- Install Anki Desktop
- Install/enable AnkiConnect add-on
- Confirm AnkiConnect is reachable locally (default `http://127.0.0.1:8765`)

### 3) Configure environment

```bash
cd /path/to/ten
cp .env.example .env
# Edit .env and set DEEPL_AUTH_KEY and GOOGLE_TRANSLATE_API_KEY
```

### 4) Run Ten server

```bash
cd /path/to/ten
npm run start
```

Default app URL: `http://localhost:3000`

### 5) verify DeepL connection (6+ word path)

```bash
cd /path/to/ten
npm run deepl:check
```

### 6) verify Google Translate connection (1-5 word path)

```bash
cd /path/to/ten
npm run google:check
```

## Access from phone

Expose through Tailscale:

1. Install Tailscale on the backup MacBook and your phone.
2. Sign both devices into the same tailnet.
3. On the backup MacBook, run `tailscale ip -4` and copy the Tailscale IP.
4. Open `http://<tailscale-ip>:3000` from your phone.

Keep AnkiConnect bound so the Ten server on the same MacBook can reach it locally.

## Keep it running 24/7 (macOS launchd)

Use `launchd` so the server restarts after reboot/crash.

### Example plist (`~/Library/LaunchAgents/com.ten.app.plist`)

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

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.ten.app.plist
```

## Update flow

When you change app code on the MacBook:

```bash
cd /path/to/ten
git pull
npm install
```

Then restart your launch agent/service if required.

## Database backup

Unlocked frequency words live in `data/ten.db` (or `TEN_DB_PATH` if set). Back up that file with Time Machine or copy it before major changes.

## App-side config in code

Translate direction, Anki deck, and Anki note type are set per language mode in `src/client/app.js` under `MODE_CONFIGS`.

## Word pool updates

When `src/client/words.pt.json` or `src/client/words.fr.json` changes:

1. Bump cache version in `src/client/sw.js` (`ten-vN` -> next number)
2. Restart Ten server if needed

The cache bump ensures clients fetch fresh PWA content.

## Frequency dictionary updates

When refreshing frequency dictionaries:

1. Run `npm run frequency:download`
2. Bump cache version in `src/client/sw.js` (`ten-vN` -> next number)
