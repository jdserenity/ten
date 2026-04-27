# Agent guidelines

## Context

This is a personal app for one user. There is no roadmap to support multiple users, accounts, sharing, or any social feature. Do not propose or add any such functionality.

## Principles

- **No frameworks.** The app is intentionally vanilla HTML/CSS/JS. Do not introduce React, Vue, Svelte, Vite, Webpack, Tailwind, or any equivalent.
- **No unnecessary dependencies.** The only npm dependency is `node-html-parser`, used in the generator script. Keep it that way unless there is a compelling reason.
- **Keep backend minimal.** This app now runs through a small Node server; avoid heavy frameworks or infrastructure unless explicitly requested.
- **`src/client/words.json` is generated, not hand-edited.** If the word data needs to change, update the generator script and re-run it.
- **Keep the structure simple.** The app should stay lightweight and understandable; avoid unnecessary file sprawl or abstraction.
- **Don't over-engineer.** This is a small personal tool. Prefer the simplest working solution.

## Deployment

Deployment is self-hosted via the Node server (`npm run start`). There is no external CI/CD requirement unless explicitly requested.
