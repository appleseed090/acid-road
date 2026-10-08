# AGENTS.md

Instructions for coding agents (and people) working on Acid Road. README.md explains what the project is and
how the warp trick works; read it first. TODO.md is the running list of pending work, open questions and
constraints: read it before starting, and update it in the same change when you finish, defer or discover
something.

## Commands

```sh
npm ci                # exact dependency versions from package-lock.json
npm run dev           # http://localhost:5173/acid-road/
npm run lint          # ESLint, typescript-eslint strictTypeChecked, zero warnings
npm run build         # tsc --noEmit (strict), then vite build into dist/
npm test              # Vitest unit tests (tests/unit)
npm run test:smoke    # Playwright against dist/ via vite preview; needs a fresh build
npm run check         # all of the above, as CI runs them
```

Run `npm run check` before every push. The smoke test needs Playwright's Chromium
(`npx playwright install chromium`; skip that in environments where Chromium is preinstalled).

## Invariants the code depends on

- **The world is static.** All warping happens in the terrain vertex shader as a function of each vertex's
  distance ahead of the camera. Do not move or rebuild geometry to animate a warp.
- **Same seed, same ride.** Biome and warp keyframes and all scenery are pure functions of (seed, position
  along the road). Never use `Math.random`, time or frame count in world logic; the only random call is
  `randomSeed()` in `src/world/random.ts`.
- **`src/world/` has no WebGL or DOM dependency**, so it runs and is tested in Node. Rendering lives in
  `src/render/`, controls in `src/ui/`, wiring in `src/main.ts`.
- **No float drift.** Chunk vertices are chunk-local; the CPU subtracts travel from each chunk's offset in
  doubles and the GPU only ever sees the small difference. Never send absolute road positions to the GPU.
- **Frustum culling stays off** unless it tests warped bounds; unwarped bounds drop visible terrain.
- **Lighting uses screen-space derivative normals**; the stored normals are wrong after warping.
- **The road corridor (columns -3 to 2) is always height 0.**

## Tests

- `tests/unit/spikeParity.test.ts` holds golden values captured from the original prototype. It fails on
  any change to how the world is generated. Update its values only for a deliberate change to the world, and
  say so in the commit message.
- Unit-test pure logic and anything that crosses a boundary (URL parameters, keyframe ranges). Verify
  rendering and page behaviour with the Playwright smoke test, not with unit tests.
- After changing warps, the warp director or the shaders, run `npm run contact-sheet` and look at the frames:
  unit tests check ranges and determinism, not whether a ride looks good.
- The smoke test pins the seed by stubbing `Math.random` and fails on any console error, page error or
  failed request. Keep the console clean: no `console.error` for expected situations.

## Code conventions

- TypeScript strict settings in `tsconfig.json`; keep new code clean under them and under the lint preset.
- Long descriptive names; comments only for a non-obvious *why*. TSDoc on exported symbols.
- Validate once where outside data enters (URL parameters, DOM lookups, WebGL context and shader
  compilation); trust internal invariants elsewhere instead of adding defensive checks.
- Pin dependency versions exactly. Vitest stays on 4.0.x until npm resolves 4.1's peers without crashing.
- Keep README.md accurate and delete docs that stop being true.

## Shipping

- The owner works on `main` directly: commit and push to `main`, no pull requests or leftover branches,
  unless asked otherwise.
- `.github/workflows/deploy.yml` runs lint, build, unit and smoke tests on every push to `main`, publishes
  `dist/` to GitHub Pages only if they pass, then smoke-tests the live URL
  (https://appleseed090.github.io/acid-road/). A change is done when that run is green.
- Vite's `base` is `/acid-road/` to match the Pages URL; keep asset URLs relative to it.
