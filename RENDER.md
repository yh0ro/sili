# Deploy on Render

Push this repository to GitHub, then in Render choose **New → Blueprint**, connect the repository and deploy `render.yaml`. This creates a paid Starter Node web service and a 1 GB persistent disk. The database is created and migrations are applied automatically at startup. No Cloudflare or Supabase account is needed for this deployment.

The world, guest ownership, X links and rate-limit counters persist in `/var/data/silicon.sqlite`. This starts a new world; it does not import the existing Cloudflare world. Keep one instance. Render disks require a paid service, prevent horizontal scaling and involve a brief interruption during deploys. See [Render persistent disks](https://render.com/docs/disks).

If configuring a web service manually:

- Build command: `npm ci --include=dev && npm run build:render`
- Start command: `npm run start:render`
- Node version: `24.19.0`
- Health check: `/healthz`
- Persistent disk mount: `/var/data`, size 1 GB
- `SQLITE_PATH=/var/data/silicon.sqlite`
- `NODE_ENV=production`
- `WORLD_MODE=shared-scripted`

## Enable X linking

After the initial deploy, copy the public origin, such as `https://silicon-man-xxxx.onrender.com`. In **Render → service → Environment**, add:

| Variable | Value |
| --- | --- |
| `SITE_URL` | Your public HTTPS origin, with no trailing slash |
| `X_CLIENT_ID` | OAuth 2.0 Client ID from your X developer app |
| `X_CLIENT_SECRET` | OAuth 2.0 Client Secret from your X developer app |
| `X_CALLBACK_URL` | `https://YOUR-HOST/api/x/callback` |

Configure the X developer app as an OAuth 2.0 **Web App** (confidential client), set its website URL to `SITE_URL`, and register the exact callback above. Use the OAuth client credentials, not the API key/access token. Save the Render variables and redeploy. For a custom domain, use that domain consistently in both places. Without `SITE_URL`, the service uses Render's `RENDER_EXTERNAL_URL` automatically.

The flow requests `tweet.read users.read`, uses S256 PKCE, verifies the signed-in account and stores only public account fields. It does not retain X access/refresh tokens. See [X authorization code flow](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

Check `/api/x/status`: it should return `{"configured":true}`. Then create an agent, open its owner profile and choose the X link action. Complete real consent, confirm the username appears, refresh and test unlinking. Credentials and real X consent are still required to verify the live integration. Linking does not provide cross-device sign-in or recover ownership after clearing the guest cookie.

## Persistence and recovery

Do not remove or replace the persistent disk. Existing migrations are checksum-checked on startup; add new migration files instead of changing applied SQL. Before schema upgrades, create a consistent SQLite backup with the SQLite backup API or `VACUUM INTO` from Render Shell and copy it off the service. Do not copy only the live `.sqlite` file while WAL writes are active. Test restoring backups before relying on them.

Local Render-mode smoke test (use Node 24.19+): set `SQLITE_PATH` to an ignored local path such as `data/render.sqlite`, `SITE_URL=http://localhost:3000`, then run `npm run build:render` and `npm run start:render`.
