# TODO

External memory for Acid Road: what's unverified, what's deferred, and the constraints to keep.

## Constraints to keep

- The world stays static. Warping happens only in the vertex shader, as a function of distance ahead.
- Warps and scenery stay pure functions of (seed, position along the road). Same seed, same ride.
- `src/world/` stays free of WebGL and DOM dependencies.
- Chunk offsets are subtracted from travel in doubles on the CPU. Never send absolute positions to the GPU.
- Frustum culling stays off unless it is done against warped bounds.
- Changing the world on purpose means updating the golden values in `tests/unit/spikeParity.test.ts`.

## Not yet verified

The prototype and this port have only run on a software renderer (SwiftShader in headless Chromium).

- [ ] **Frame rate on a real GPU.** Measure on a desktop GPU and an integrated laptop GPU.
- [ ] **Frame rate on phones** (iOS Safari, Android Chrome). Every chunk is drawn every frame with no culling,
      and the Ceiling warp doubles that.
- [ ] **The automatic warp sequence over a long ride.** Some keyframe combinations may look messy, for example
      strong Twist plus Roll plus Pinch together. Watch several seeds for several thousand metres.
- [ ] **The mirrored Ceiling warp.** It is the roughest one: it draws the whole world a second time, clips
      against the main world in some combinations, and costs double the draw calls.

## Deferred refactors and ideas (not for the port)

- [ ] The vertex cap (200,000 per chunk) is far above real use: across many seeds the largest chunk seen was
      about 26,400 vertices. The shared index buffer (1.2 million 32-bit indices, about 4.8 MB) could shrink.
- [ ] `BiomeKeyframes.at` allocates a new `Float32Array` per call (18 per chunk build, 1 per frame).
- [ ] Keyframe caches grow forever over a long ride (one entry per 420 or 640 blocks). Negligible for now.
- [ ] Self-host the two fonts to drop the Google Fonts dependency.
- [ ] Move to Vitest 4.1 or later once npm resolves its peer dependencies without crashing.
