# Agent guidelines

## Context

This is a personal app for one user. There is no roadmap to support multiple users, accounts, sharing, or any social feature. Do not propose or add any such functionality.

## Principles

- **No frameworks.** The app is intentionally vanilla HTML/CSS/JS in a single file. Do not introduce React, Vue, Svelte, Vite, Webpack, Tailwind, or any equivalent.
- **No unnecessary dependencies.** The only npm dependency is `node-html-parser`, used in the generator script. Keep it that way unless there is a compelling reason.
- **No backend.** This is a static site. Do not add serverless functions, APIs, or any server-side logic.
- **`public/words.json` is generated, not hand-edited.** If the word data needs to change, update the generator script and re-run it.
- **Keep the app in one file.** `public/index.html` contains markup, styles, and JS. Do not split it without a strong reason and explicit user approval.
- **Don't over-engineer.** This is a small personal tool. Prefer the simplest working solution.

## Deployment

Netlify deploys automatically from `main`. The publish directory is `public/`. There is no CI build step for the app itself — only `public/` contents are deployed.
