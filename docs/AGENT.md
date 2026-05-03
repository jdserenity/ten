# Agent guidelines

## Context

This is a personal app for one user. There is no roadmap to support multiple users, accounts, sharing, or any social feature. Do not propose or add any such functionality.
Translation routing is intentional: use Google Translate for short inputs (1-5 words, punctuation ignored) and DeepL for 6+ words.

## Principles

- **KEEP MY STYLE!** My style is extremely important to me.
- **No frameworks.** The app is intentionally vanilla HTML/CSS/JS. Do not introduce React, Vue, Svelte, Vite, Webpack, Tailwind, or any equivalent.
- **No unnecessary dependencies.** The only npm dependency is `node-html-parser`, used in the generator script. Keep it that way unless there is a compelling reason.
- **Keep backend minimal.** This app now runs through a small Node server; avoid heavy frameworks or infrastructure unless explicitly requested.
- **`src/client/words.json` is generated, not hand-edited.** If the word data needs to change, update the generator script and re-run it.
- **Keep the structure simple.** The app should stay lightweight and understandable; avoid unnecessary file sprawl or abstraction.
- **Don't over-engineer.** This is a small personal tool. Prefer the simplest working solution.
- **Update .md files with frequency** You should be updating AGENT.md, ARCHITECTURE.md, DEPLOY.md, and README.md with frequency. They are all guideline files and so when the guidelines change, you should update the files so future agents and yourself know what the deal is.
- **Lean Readme.** I don't like bulky readme's. This project is just for me. I'm the only person that's going to be looking at it.
- **Mobile-first interaction assumptions.** This is a mobile PWA first, so avoid desktop-only UX suggestions (for example, `Esc` shortcuts) unless explicitly requested.

## Deployment

Deployment is self-hosted via the Node server (`npm run start`). There is no external CI/CD requirement.
