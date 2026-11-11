---
name: deploy-production
description: >-
  Push Ten to the production VPS over Tailscale (ssh linuxuser@gp-vps-1,
  git pull, systemctl restart ten). Use when the user asks to deploy, ship to
  production, push to prod, restart the live app, or update the VPS.
---

# Deploy Ten to production

Do this only when the maintainer asks to deploy / ship / update production. Do not deploy after every commit on your own.

## Preconditions

1. The commits to ship are already on the git remote the VPS pulls from (`origin`, usually `main`). If local work is unpushed, push it first and confirm.
2. **Tailscale must be open** on this machine. Check with `tailscale status` (or ping/`ssh` reachability to `gp-vps-1`). If Tailscale is down or the host is unreachable, stop and tell the maintainer to open Tailscale — do not invent another path.

## Deploy steps

Run over SSH (no password):

```bash
ssh linuxuser@gp-vps-1 'cd prod-apps/ten && git pull && sudo systemctl restart ten'
```

Equivalent interactive sequence if a one-liner fails:

```bash
ssh linuxuser@gp-vps-1
cd prod-apps/ten
git pull
sudo systemctl restart ten
```

## Afterward

- Confirm the remote command exited 0.
- If `git pull` reported conflicts or `systemctl` failed, show the maintainer the output and stop — do not force-reset or mask the error.
- Tell the maintainer production was updated (or what blocked it).
