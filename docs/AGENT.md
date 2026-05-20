# Agent guidelines

## Context

This is a personal app for one user. There is no roadmap to support multiple users, accounts, sharing, or any social feature. Do not propose or add any such functionality.
Translation routing is intentional: use Google Translate for short inputs (1-5 words, punctuation ignored) and DeepL for 6+ words, for both PT-BR and French modes.
The app has two learning tracks (Brazilian Portuguese and French). Portuguese stays intermediate-oriented; French starts from beginner top-frequency vocabulary.
Frequency dictionaries are bundled static files (`frequency-pt-br.json` and `frequency-fr.json`) and learned highlighting is based on words seen in the 10/day tab or unlocked by translating a single learning-language word in the translate tab. Unlock state and the current 10/day card index (per language + calendar day) are stored in SQLite (`data/ten.db`) via the Node server, not in the browser. Tapping a frequency-list word runs a live translate (learning language → English) inline.

## Principles

- **KEEP MY STYLE!** My style is extremely important to me.
- **No frameworks.** The app is intentionally vanilla HTML/CSS/JS. Do not introduce React, Vue, Svelte, Vite, Webpack, Tailwind, or any equivalent.
- **No unnecessary dependencies.** Runtime deps are `better-sqlite3` (unlock persistence), `dotenv`, and `node-html-parser` (generator script). Avoid adding more unless there is a compelling reason.
- **Keep backend minimal.** This app now runs through a small Node server; avoid heavy frameworks or infrastructure unless explicitly requested.
- **`src/client/words.pt.json` is generated, not hand-edited.** If PT-BR word data needs to change, update the generator script and re-run it.
- **Keep the structure simple.** The app should stay lightweight and understandable; avoid unnecessary file sprawl or abstraction.
- **Don't over-engineer.** This is a small personal tool. Prefer the simplest working solution.
- **Update .md files with frequency** You should be updating AGENT.md, ARCHITECTURE.md, DEPLOY.md, and README.md with frequency. They are all guideline files and so when the guidelines change, you should update the files so future agents and yourself know what the deal is.
- **Lean Readme.** I don't like bulky readme's. This project is just for me. I'm the only person that's going to be looking at it.
- **Mobile-first interaction assumptions.** This is a mobile PWA first, so avoid desktop-only UX suggestions (for example, `Esc` shortcuts) unless explicitly requested.

## Deployment

Deployment is self-hosted via the Node server (`npm run start`). There is no external CI/CD requirement.
