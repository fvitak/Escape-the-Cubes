# Escape the Cubes (Vite + TypeScript + Phaser 3)

Top-down dungeon crawler with room-by-room progression, instant death, a boss fight,
and a built-in **level editor**.

Live: https://escape-the-cubes.vercel.app

## Run locally

1. `npm install`
2. `npm run dev`
3. Open the local URL shown by Vite (usually `http://localhost:5173`)

## Opening menu

- **PLAY** - start a run (Enter/Space also works)
- **EDIT LEVELS** - create, edit, and arrange levels

## Controls (in game)

- `WASD` or Arrow keys: move
- `M`: toggle music ON/OFF
- `R`: restart run
- `Esc`: back to menu (or back to the editor during a test play)

## Run flow

- Room 0: empty antechamber with on-screen instructions, exit is always TOP
- Then: every level checked in **Edit Levels**, in playlist order
- Finally: the boss arena, and the Level 2 escape sequence after the boss falls

## Levels

Random generation has been removed. The game ships with 5 locked-in built-in
levels (snapshotted from the original generator, in `src/levels/builtin.ts`)
plus any custom levels you create.

### Level editor

- Palette of established pieces: 1x1 / 2x2 / 3x3 blocks, green + red cubes,
  entrance and exit doors, eraser
- Click a piece to arm it; a grid-snapped ghost previews placement
  (green = valid, red = invalid). Left click places, right click erases,
  Esc cancels the armed tool, Ctrl+Z undoes (up to 30 steps)
- Every level must have an entrance and an exit, and they can never share
  a wall; door approaches are kept clear automatically
- Saving requires a clear path from spawn to exit (checked automatically)
- **TEST** plays the level instantly; Esc returns to the editor
- Custom levels and the playlist are stored in the browser (localStorage)

### Arrange the run

The Edit Levels screen lists all levels. The checkbox includes/excludes a level
from the run, ▲/▼ reorders, EDIT/DEL manage custom levels (built-ins are locked).

## Boss test portal

Add `?boss=1` to the URL to show a warp portal in Room 0 that jumps straight
to the boss arena.

## Enemies

- Green cubes: fast turners, slower top speed
- Red cubes: faster but clumsy
- Enemies spawn briefly "shocked" (no movement, no contact kill) with a `!` marker

## Music

- Loaded from `public/audio/dungeon_theme.mp3`, starts when the first level
  begins, loops at volume `0.25`, `M` toggles mute
