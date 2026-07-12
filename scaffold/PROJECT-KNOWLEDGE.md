# Project knowledge

Hard-won lessons and traps. Product/system facts live only in `scaffold/ARCH-LLM.md` / `scaffold/ARCH-HUMAN.md` — do not restate them here. Word-pool quality standards and the abandoned scrape story live in `scaffold/generating-words.md`.

## Service worker cache must be bumped by hand
`src/client/sw.js` pins a cache name (`ten-vN`) and a fixed asset list. Changing `words.*.json`, frequency JSON, icons, CSS, or JS without bumping `ten-vN` leaves phones on stale cached files. Always bump after those edits.

## Procedural PWA icons were a dead end
An old script generated icons at runtime. At 192/512px the results looked bad. Icons are now committed static PNGs (`icon-192.png` / `icon-512.png`, aurora design). Replacing the look means replacing those PNGs and bumping the SW cache — do not revive a procedural generator.

## Default port is 3001, not 3000
Older docs said `3000`. The server defaults to `PORT` or **3001**, and scans upward if the port is taken. Use whatever URL the process prints; Tailscale phone bookmarks should match that port.

## Do not hand-edit `words.pt.json`
Portuguese pool content comes from `npm run generate:pt`. Hand edits get overwritten on the next generate. Change the generator (or follow `scaffold/generating-words.md`) and regenerate.

## Confetti is gated in localStorage on purpose
The 10/day completion burst is once per language per calendar day. That gate is client `localStorage`, not SQLite, so a refresh after finishing does not fire confetti again. Daily card *position* is server-side; celebration “already fired” is not.
