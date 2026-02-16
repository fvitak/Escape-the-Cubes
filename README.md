# Full-Screen Room Dungeon MVP (Vite + TypeScript + Phaser 3)

Top-down dungeon crawler MVP with room-by-room progression, dense small-block layouts, enemy shock windows, instant death, and background music.

## Run locally

1. `npm install`
2. `npm run dev`
3. Open the local URL shown by Vite (usually `http://localhost:5173`)

## Controls

- `WASD` or Arrow keys: move
- `M`: toggle music ON/OFF
- `R`: restart run

## Room flow

- Total rooms: 6 (Room 0 through Room 5)
- Room 0:
  - empty room
  - center spawn
  - no enemies
  - no obstacles
  - exit is always TOP
- Rooms 1-5:
  - visible entrance + interactive exit doorway
  - exit side random per run and never equals entrance side
  - doorway continuity preserved across transitions

## Obstacles

- Rooms 1-5 use many small grid-based blocks (tile-like)
- Mid-room clutter band + additional clusters create lanes/chokepoints
- Guaranteed carved path from spawn to exit (solvable)
- Progressive density increase by room index

## Enemies

- Room 1: 1 enemy
- Room 2: 2 enemies
- Room 3: 3 enemies
- Room 4: 4 enemies
- Room 5: 5 enemies
- Enemies do not persist between rooms
- Spawn constraints:
  - random valid points
  - not in walls/obstacles
  - away from player spawn
  - min distance from entrance door point = `0.5 * min(roomWidth, roomHeight)`

## Shock behavior

- Enemies spawn with a brief shock delay (~250-600 ms depending on context)
- During shock they do not move and do not cause contact loss
- Visual cue: pop/wobble with `!` marker

## Win/Lose

- Enemy contact (after shock) => `YOU LOSE`
- Exit in Room 5 => `YOU WIN`
- Gameplay freezes on result overlay

## Music

- Loaded from `public/audio/dungeon_theme.mp3`
- Starts at run begin, loops at volume `0.25`
- Stops on win/lose and scene shutdown
- `M` toggles mute
- No duplicate overlapping playback on transitions/restart

## Debug overlay

Shows:
- Room #
- Entrance side
- Exit side
- Enemy count
- Shock state
- Music ON/OFF
