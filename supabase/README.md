# Supabase

Saves missions and minigame scores. It is optional: without these steps the app works the same and
keeps everything in the browser.

## Setup (once)

1. Create a project at <https://supabase.com>.
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins:** turn it on.
3. **SQL Editor:** paste and run the contents of
   [migrations/20261114000000_misiones_y_puntuaciones.sql](migrations/20261114000000_misiones_y_puntuaciones.sql).
4. **Project Settings → API:** copy the project URL and the public key (`anon` or `publishable`) into
   a `.env.local` file at the repository root:

```bash
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

5. Restart `npm run dev`. The start screen should say "Saved to the cloud".
6. Share those two values with teammates through a private channel. For the GitHub Pages build, set
   them as repository variables with the same names.

`.env.local` is not committed. The `service_role` (or `secret`) key **never** goes there: it bypasses
row-level security. If it is pasted by mistake, the app detects it and does not use it.

## What gets saved

| Table | Contents | Who can |
|---|---|---|
| `missions` | `state.mission` and `state.clock` in the `data` column | Only its owner (read and write) |
| `scores` | game, alias (1–16 characters) and points | Anyone reads; each user inserts their own |

The session is anonymous and lives in the browser: another computer is another user for Supabase.
The current mission syncs automatically whenever the state changes.

## For modules

Modules never import the client. They use `src/services/index.js`:

| Function | What it does |
|---|---|
| `submitScore(game, alias, points)` | Records a score (it is always kept locally too) |
| `topScores(game, limit)` | Best scores; says whether they come from the cloud or from local storage |
| `getStatus()` / `onStatus(fn)` | Saving status: `local`, `connecting`, `saving`, `synced`, `offline` |
