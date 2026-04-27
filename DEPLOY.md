# Deploying

## Production target

This app runs on your always-on backup MacBook (effectively 24/7):

- Anki Desktop running continuously
- AnkiConnect enabled in Anki
- Ten Node server running continuously
- Optional: LibreTranslate service running continuously (or remote endpoint)

No Netlify, no static publish directory.

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

### 3) Run Ten server

```bash
cd /path/to/ten
npm run start
```

Default app URL: `http://localhost:3000`

## Access from phone

Use one of these:

- Same Wi-Fi: open `http://<macbook-lan-ip>:3000`
- Private overlay (recommended): Tailscale/ZeroTier

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

## words.json updates

When `src/client/words.json` changes:

1. Bump cache version in `src/client/sw.js` (`ten-vN` -> next number)
2. Restart Ten server if needed

The cache bump ensures clients fetch fresh PWA content.
