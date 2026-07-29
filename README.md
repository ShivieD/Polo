# Polo

**Train your eye.** Twelve sensory drills that sharpen how you see colour and form — six colour instruments, six shape instruments, each with its own difficulty ladder, progression track and leaderboard.

## The instruments

**Colour**

| Instrument | What it trains |
|---|---|
| Color Match | Spot the exact colour among near-identical swatches |
| Color Mixer | Blend the dials until your mix melts into the target |
| Repeat the Pattern | Watch the pads fire, then answer in exact order |
| Find the Spot | Pin a colour to its exact home on a gradient |
| Spot the Difference | One block drifted off-colour — find it |
| Count it All | Count the pieces before they vanish |

**Shapes**

| Instrument | What it trains |
|---|---|
| Shape Match | Find the twin among a field of near-matches |
| Match the Tilt | Memorise an angle, then reproduce it |
| Repeat the Chain | Recall a sequence of shapes in order |
| Round the Corner | Match a corner radius by eye |
| Spot the Shift | Catch the shape that moved, rotated or resized |
| Count the Shapes | Count fast, before the board clears |

## How progression works

Each instrument runs its own independent track — there is deliberately no cross-game total.

- **Levels.** A level is a cycle of five runs. Advancing requires all five to be *clean* passes. Shape Match runs to L8; everything else caps at L6.
- **Lives.** You start with five. A miss with lives in reserve spends one: your streak survives, but that run is no longer clean, so the level replays. A miss with no lives breaks the streak and restarts the cycle.
- **Points.** Flat and never level-weighted. Score-based instruments bank their 0–100 round score; hit-or-miss instruments bank 100 per catch.
- **Trades.** Down to your last life, you can trade points for another. When a miss breaks a streak at zero lives, you get one chance to buy it back on the spot.
- **Mastery.** Clear the final level and you earn a downloadable certificate — rendered to canvas, shareable as a PNG.

Points and best-streak are a permanent record. A player-triggered reset clears only live play state — level, lives, current streak — never the banked record.

## Leaderboard

Per-instrument boards, ranked by banked points and by best streak, with a score-distribution curve showing where you land in the field. Your own row stays pinned even when you fall outside the top ten.

Identity is anonymous: a UUID generated in the browser, plus a display name you choose. No account, no auth. The dashboard lets you rename yourself or switch to a fresh player — both warn you first, since without auth an old name can't be relinked to its scores.

**The leaderboard is optional.** With no backend configured the app runs against a deterministic local field, so the boards are populated rather than empty.

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

## Optional: a real leaderboard

Without these the app is fully playable — it just keeps scores on-device.

1. Create a free [Supabase](https://supabase.com) project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor. This creates the `players` and `game_stats` tables and the `submit_score` RPC.
3. Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
```

All writes go through `submit_score`, a `security definer` function that clamps values and only ever lets totals grow — so the anon key can't be used to forge or lower a score. Row-level security keeps the tables read-only to clients.

> `.env` is gitignored. Keep real keys out of `.env.example`.

## Built with

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · [Motion](https://motion.dev) · Supabase (optional)

Motion runs with `reducedMotion="user"`, so the whole app respects `prefers-reduced-motion`.

## Accessibility & theming

Light and dark are driven by a `data-theme` attribute rather than the OS preference, defaulting to light. Colour is carried by CSS custom properties (`--color-paper`, `--color-ink`, `--color-mut`, `--color-line`), with a separate `--color-ink-fixed` for surfaces that must not invert — badge text on a yellow chip, for instance, which would otherwise turn white and vanish in dark mode.
