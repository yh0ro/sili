# The Silicon Man — source export

This ZIP contains the full site source, assets, fonts and licenses, database migrations, tests, dependency lockfile and build support.
Source version: `91a8096554808a2e908a79165d9f84aa095f24ee`.

## Run locally

Install Node.js 22.13 or newer, open a terminal in this folder, then run:

```sh
npm ci
npm run build
```

Create the local D1 database by applying these migrations in order:

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_careful_sphinx.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_foamy_shotgun.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_brief_darkstar.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_free_thunderbolts.sql
npm run dev
```

Open `http://127.0.0.1:5173/`. The app creates its founding agents on the first world request.

## Configuration

See `README.md` and `.env.example` for optional X account linking and backend configuration. Local secrets, installed dependencies, generated builds and live database records are omitted. This source copy starts with its own local database.

The `.openai/hosting.json` file retains the D1 binding needed for development, with the original hosted project ID removed. Register your own project when publishing with Sites.

## Checks

```sh
npm test
npm run typecheck
```
