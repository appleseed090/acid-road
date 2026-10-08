# Acid Road

A live browser ride down a straight road through random block terrain that warps as you travel. The road
twists, rolls up into a tube, swerves, waves, stretches and folds a mirrored copy of the world over your head.
Inspired by the "Minecraft Acid Interstate" videos; nothing from Minecraft is used, and it is not synced to music.

**Live:** https://appleseed090.github.io/acid-road/

Controls: the panel at the bottom left sets speed, warp strength and view angle, and lets you set the warps
by hand. **Space** pauses, **H** hides the controls, **New world** rolls a new seed. If your system asks for
reduced motion, the ride starts paused.

### Link options

The address bar always holds a link to the current world, so you can share or bookmark a ride.

| Parameter | Meaning | Example |
| --- | --- | --- |
| `seed` | World seed, 0 to 2147483647. Missing means a random world. | `?seed=4242` |
| `at` | Start this many metres down the road, with the warps already as they are there. | `?seed=4242&at=5000` |
| `stats` | Show a performance overlay: FPS, frame and CPU time, draw calls, triangles, chunk build time, canvas size, and the GPU the browser reports. | `?stats` |

Invalid values are ignored with a console warning. **New world** keeps `stats`, sets the new `seed` and drops
`at`.

### Measuring performance

Open https://appleseed090.github.io/acid-road/?stats on the device, let it ride for half a minute, and note
the overlay. "CPU" is main-thread time per frame; when FPS is low but CPU time is small, the GPU is the
limit. The GPU line says "SwiftShader" or "llvmpipe" when the browser fell back to software rendering. Watch
"Draws" double while the Ceiling warp is active: it draws the world twice.

## Prerequisites

- Node.js 20.19 or newer (CI uses Node 22) and npm.
- A browser with WebGL 2.
- For the smoke test only: Playwright's Chromium (`npx playwright install chromium`).

## Run, build, test

```sh
npm ci                # install exact dependency versions from package-lock.json
npm run dev           # dev server with hot reload: http://localhost:5173/acid-road/
npm run build         # type-check (tsc, strict) and build the static site into dist/
npm run preview       # serve dist/ at http://localhost:4173/acid-road/
npm run lint          # ESLint with typescript-eslint strict type-checked rules, zero warnings allowed
npm test              # unit tests (Vitest) for the pure world logic
npm run test:smoke    # Playwright: serves dist/, loads the page, fails on any console error or blank canvas
npm run check         # all of the above, in the order CI runs them
```

`npm run test:smoke` needs a fresh `npm run build` first. Set `SMOKE_BASE_URL` to run the same smoke test
against a deployed copy instead, for example
`SMOKE_BASE_URL=https://appleseed090.github.io/acid-road/ npx playwright test`.

## How the warp trick works

**The world never moves or changes shape.** Terrain is ordinary static block geometry, built once per
16-block chunk. All the warping happens in the vertex shader (`src/render/shaders.ts`), as a function of
each vertex's distance *ahead* of the camera. A vertex at the camera is unwarped; the further ahead it is,
the more it is twisted around the road axis, bent into a tube (Roll), lifted (Rise), pushed sideways
(Swerve), rippled (Waves), stretched vertically (Stretch) or squeezed toward the road (Pinch). As you drive
forward, distant land straightens out exactly as it reaches you, which is what makes the world look like it
is unrolling. Ceiling draws the whole world a second time, mirrored upside down above you.

Supporting tricks:

- **Deterministic from a seed.** Scenery keyframes ("biomes", every 640 blocks) and warp keyframes (every
  420 blocks) are pure functions of (seed, position along the road), cross-faded between keyframes. The
  same seed always gives the same ride. The two periods differ so scenery and warps drift out of step.
- **No float drift.** Chunk vertices are stored chunk-local, so they stay small. Each frame the CPU
  subtracts travel distance from each chunk's position in doubles and sends only that small offset to the
  GPU, so precision holds however far you ride.
- **Chunks are recycled.** 25 chunk buffers (23 ahead, 1 behind, the current one) are reused as you move,
  at most two rebuilt per frame, nearest first.
- **No frustum culling, on purpose.** Warped geometry ends up nowhere near its unwarped bounds, so culling
  against those bounds would drop visible terrain. Every loaded chunk is drawn.
- **Screen-space normals.** The stored face normals are wrong once a face is bent, so the fragment shader
  rebuilds the true normal from screen-space derivatives of the warped position (`dFdx`/`dFdy`).
- **Long faces are subdivided** so they have enough vertices to bend smoothly.

## Architecture

| Path | Role | Depends on |
| --- | --- | --- |
| `src/world/random.ts` | Seeded hash, value and fractal noise, smoothstep | nothing |
| `src/world/color.ts` | HSL to RGB, colour mixing | nothing |
| `src/world/constants.ts` | World dimensions, chunk and keyframe spacing | nothing |
| `src/world/biomes.ts` | Biome keyframes, blending, column heights | random, color |
| `src/world/warps.ts` | Warp definitions and the automatic warp director | random |
| `src/world/world.ts` | Bundles one seed's biomes and warps | biomes, warps |
| `src/world/chunkMesh.ts` | Builds one chunk's vertex data into a scratch buffer | world |
| `src/render/shaders.ts` | GLSL ES 3.0 sources for terrain and sky | constants |
| `src/render/projection.ts` | Perspective matrix | nothing |
| `src/render/renderer.ts` | WebGL2 context, chunk streaming, drawing | world, shaders |
| `src/ui/controls.ts` | Panel, buttons, keyboard shortcuts | warps (names and ranges) |
| `src/ui/rideParams.ts` | Parses and writes the `seed`, `at` and `stats` link options | nothing |
| `src/ui/statsOverlay.ts`, `src/ui/frameStatistics.ts` | The `?stats` performance overlay | nothing |
| `src/main.ts` | Wires everything together and runs the frame loop | all of the above |

Everything under `src/world/` is pure TypeScript with no WebGL or DOM dependency, so it runs and is tested in
Node. `tests/unit/spikeParity.test.ts` pins the world logic to golden values captured from the original
single-file prototype, so an accidental change to how the world looks fails the tests.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: lint, type-check and build, unit tests, then the
Playwright smoke test against the built site. Only if all of that passes does it publish `dist/` to GitHub
Pages. A final job reruns the smoke test against the live URL. The Vite `base` is `/acid-road/` to match
the Pages URL.

## Contributing

See [AGENTS.md](AGENTS.md) for the invariants the code depends on, test rules and conventions, and
[TODO.md](TODO.md) for open work.

## Decisions

- **Faithful port.** The first version reproduces the prototype exactly: chunk meshes and keyframes are
  byte-identical, and with a fixed seed, still and warped screenshots match the prototype pixel for pixel. The
  Ceiling scene differs only as much as two runs of the prototype itself differ. Known rough edges were kept and listed in
  [TODO.md](TODO.md) rather than fixed in the port.
- **Strict TypeScript** (`strict`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnused*`, and
  others in `tsconfig.json`). `noUncheckedIndexedAccess` is off: the mesh builder and noise code index typed
  arrays in hot loops, where it would force a non-null assertion on nearly every line for no real safety.
- **ESLint** uses typescript-eslint's `strictTypeChecked` preset.
- **Dependencies are pinned to exact versions.** Vitest is held at 4.0.x because npm 10.9 crashes resolving
  4.1's peer dependencies.
- **Fonts** still load from Google Fonts, as in the prototype.
- **The smoke test pins the seed** by stubbing `Math.random` (the app's only use of it), so every run rides
  the same world. Unit tests cover many seeds.
- **Uniform locations are looked up by name** from a typed list, so a typo is a compile error. A uniform
  the driver optimised away resolves to null, and setting it is a no-op, as in the prototype.
