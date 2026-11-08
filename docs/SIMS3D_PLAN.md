# The Sims 3D — build plan

The next big project: rebuild The Sims (currently `js/sims.js`, a 2D isometric canvas game)
as a **full 3D game** with Three.js, as close to the real Sims games as possible.
Bigger than Minecraft (`js/minecraft.js`).

## Hard rules
- **No external model sites (no Sketchfab, no downloads, no accounts).** Every 3D model
  — Sims, furniture, walls, houses, trees, cars — is built procedurally in code from
  Three.js geometry (boxes, cylinders, lathes, extrusions, merged geometry), like
  `js/gta.js` and `js/doom.js` build their worlds. Textures (wood grain, carpet, tile,
  wallpaper, fabric) are generated on canvases.
- Three.js is already loaded as `window.THREE` (importmap in `index.html`). Wait for it
  exactly like `js/gta.js` does (`window.THREE` or the `three-ready` event).
- Keep it **non-explicit** the way the real game is: the pixelated censor mosaic while
  showering / bathing / using the toilet (the Sim is never modeled unclothed — the mosaic
  covers a clothed body), and WooHoo / Try for Baby shown only as the couple under the
  covers with hearts. No other animation of it.
- Must run smoothly on an **iPad** (touch controls, ~60 fps): low-poly meshes, instanced
  geometry for repeated items, one shadow-casting light, pixel ratio capped at 2.
- Self-terminating render loop + `wm-cleanup` teardown (dispose geometries, materials,
  textures, renderer), like `js/gta.js` / `js/minecraft.js`.
- Save to `appData.sims3d` (keep the old 2D game's `appData.sims` untouched).

## Architecture
- `js/sims3d/` would be nice, but the app loads plain scripts from `index.html`, so use a
  few files that attach to `window`:
  - `js/sims3d-core.js` — simulation only (no drawing): needs, actions, free will,
    careers, skills, relationships, aging, family, money, time. Port and extend the
    logic from `js/sims.js` (it is tested and works). Pure data + update(dt).
  - `js/sims3d-models.js` — procedural model factories: `makeSim(look)`,
    `makeObject(type)`, `makeWall`, `makeWindow`, `makeDoor`, `makeTree`, `makeCar`…
  - `js/sims3d.js` — renderer, camera, input, UI (needs panel, pie menus, modes).
- Asset credits: every outside asset gets a line in `CREDITS` (js/sims.js, `window.SIMS.CREDITS`), shown on the startup screen and in Options → Credits. The 3D game reuses that list.
- Register as a game: `games.sims3d` in `js/games.js`, a Store entry in `js/data.js`,
  an Xbox tile in `js/xbox.js`, an icon in `js/icons.js`, script tags in `index.html`.
  Keep the 2D Sims available as "The Sims Classic".

## 3D world
- **Camera:** Sims 2/3 style — orbit around a focus point, 4 snap rotations (Q/E) plus
  free rotate (right-drag / two-finger twist), zoom (wheel / pinch), pan (drag / WASD).
- **Walls:** real wall meshes with thickness, baseboards, windows and doors cut in.
  Three view modes like the real game: **Walls Up / Cutaway / Walls Down** (cutaway hides
  walls facing the camera, updating as the camera rotates).
- **Lighting:** sun that moves with game time, sky gradient, night with lamps as point
  lights (few, shadowless), TV glow, window light at night.
- **Floors/terrain:** grass with a lot boundary, sidewalk, street, driveway, fences;
  per-room floor textures; multiple floors with stairs (Phase 3).
- **Sims:** low-poly articulated humanoids (hips, torso, head, upper/lower arms & legs,
  hands, feet), hair meshes (several styles), clothing colors, body shapes, skin tones,
  male/female, ages (baby → toddler → child → teen → adult → elder) scale and proportions.
  Procedural animation: walk cycle, idle sway, sit, lie, eat, cook, type, read, dance,
  talk gestures, wave, hug, kiss (a peck), sleep, shower (with mosaic), exercise, paint.
  Plumbob above the active Sim; thought and speech bubbles as sprites with Simlish.
- **Furniture (procedural):** beds (single/double), sofa, armchair, dining set, desk,
  computer, TV, stereo, bookshelf, fridge, stove, counter, sink, toilet, shower, tub,
  mirror, easel, chess table, treadmill/bench, lamps, plants, rugs, paintings, crib,
  toys, dressers, trash can, mailbox, phone, fireplace, hot tub, pool (Phase 3).

## Gameplay (port everything from `js/sims.js`, then add)
- Everything the 2D game already has: 8 needs + plumbob mood, pie menus, action queue,
  free will, Create-a-Sim with 5 traits, Buy mode, 6 skills, 4 careers with carpool,
  bills and Repo Man, neighbors, Flirt → Kiss → Move In / Propose → WooHoo / Try for Baby,
  pregnancy, baby, social worker, growing up, adoption, accidents, hospital.
- **New:**
  - **Whole household is playable** — click any family member to control them
    (Sims 1 behavior), each with their own needs, skills, job and relationships.
  - **Life stages and aging**: baby, toddler, child, teen, young adult/adult, elder;
    birthday cake "Grow Up"; elders eventually pass on (Grim Reaper, gentle, tombstone).
  - **Kids go to school** on the school bus; homework; report cards.
  - **Aspirations, wants and fears** (Sims 2): pick an aspiration in CAS; wants panel
    gives rewards; fears lower mood.
  - **Build mode**: draw walls, place doors/windows, paint walls, lay floors, add stairs,
    a second floor, a pool; undo; costs money; sell/return.
  - **Buy mode in 3D**: rotate objects (4 directions), move, sell, eyedropper; grid snap.
  - **Cooking** with skill: chance of a kitchen fire at low skill, fire alarm, firefighter.
  - **Neighborhood view**: several lots (yours + neighbors' houses, a community park);
    move into a new house; visit neighbors.
  - **Mail, newspaper, phone**: order pizza / groceries, invite, call, adopt.
  - **More careers** (8+ tracks × 10 levels), chance cards at work.
  - **Moodlets / memories**: life events recorded in a family album.
  - **Music**: Buy-mode and Build-mode music (synthesized like the Canva audio tracks).

## Phases (ship each one, test headlessly, commit + push)
1. Engine: Three.js scene, procedural house (walls + cutaway + floors), camera controls,
   day/night, a 3D Sim that walks via A* on the lot grid, port of the simulation core,
   needs panel + pie menu + queue; the core objects with their interactions. → playable.
2. Full port of everything in `js/sims.js` (careers, social, romance, family, Buy mode,
   bills, CAS in 3D with a rotating preview), censor mosaic, WooHoo hearts.
3. Build mode, second floor/stairs, pool, rotation of objects, more furniture.
4. Playable households (switch Sims), life stages + aging, school, aspirations/wants.
5. Neighborhood view with multiple lots, visiting, moving house, community lot.
6. Polish: animations, sounds/music, performance pass for iPad, tutorial.

## Testing (like every other game here)
- Headless Playwright with Chromium at `/opt/pw-browsers/chromium`, serving the repo on
  `http://localhost:8099` (`python3 -m http.server 8099`). Three.js must be vendored for
  tests: download `three@0.160.0` files from unpkg into the scratchpad and route
  `unpkg.com/three@0.160.0/*` to them (see how earlier tests did it), plus Chromium flags
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- Expose a test hook (`host.__sims3d`) to drive time, queue actions and read state.
- Verify every phase: no console errors, every interactive object reachable, save/reload,
  screenshots inspected; then the all-apps smoke test.

## Deploy
Work on branch `claude/windows-12-setup-experience-FsKgd`, app at the repo root. Pushing
that branch deploys the live site. Bump the `?v=` build token in `index.html` on each
deploy (`sed -i "s/v=OLD/v=NEW/g" index.html`).
