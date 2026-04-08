# Deploying

## First deploy

```bash
netlify login        # opens browser to authenticate
netlify deploy --dir=public --prod
```

The site is live at whatever URL Netlify assigns. You can rename it in the Netlify dashboard under **Site settings → Site details**.

## Redeploying

Any time you push to `main` on GitHub, Netlify redeploys automatically. So the normal flow is:

```bash
git add -A
git commit -m "your message"
git push
```

That's it. Netlify picks it up within a few seconds.

## After updating words.json

Two things are required — skipping either will leave users (you) with stale cached content:

1. **Bump the cache version in `public/sw.js`** — change `ten-vN` to the next number
2. **Push to main** as above

The service worker version bump forces the browser to discard the old cache and fetch the new `words.json` on next load.

## Checking a deploy

The Netlify dashboard at app.netlify.com shows deploy history and status. Each deploy takes ~10 seconds. If something looks wrong, you can roll back to a previous deploy from the dashboard with one click.
