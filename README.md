# Global Fin

Multi-user investment tracker for India: record buys, sell with FIFO matching, and see realised gains with capital-gains tax applied. Free stack: Next.js on Vercel Hobby, Neon Postgres, Google sign-in.

## Local setup
1. Create a free Postgres at https://neon.tech and copy the connection string.
2. Create a Google OAuth client (Google Cloud Console, Credentials, Web application).
   Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-app>.vercel.app/api/auth/callback/google`.
3. `cp .env.local.example .env.local` and fill in `DATABASE_URL`, `AUTH_SECRET` (`npx auth secret`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
4. `npm install`, `npm run db:push` (creates tables), `npm run dev`.

## Deploy (free)
Push to GitHub, import the repo in Vercel, add the same four env vars, deploy. Run `npm run db:push` once against the Neon database.

## Structure
- `src/domain` pure tax/FIFO/gain logic and tests (`npm test`). Tax rates live in `taxRules.ts`; re-check them each Union Budget.
- `src/features/*` one folder per feature (UI, server actions, queries).
- `src/db` Drizzle schema and client.

Tax output is an estimate, not tax advice. Surcharge, indexation for pre-Jul-2024 property and cross-year loss set-off are not modelled.
