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

- [ ] **Frame rate on a real GPU.** Measure on a desktop GPU and an integrated laptop GPU: open the live page
      with `?stats` (see README, "Measuring performance") and record the overlay here.
- [ ] **Frame rate on phones** (iOS Safari, Android Chrome), the same way. Every chunk is drawn every frame
      with no culling, and the Ceiling warp doubles that.

Baseline, for comparison only: headless Chromium on SwiftShader (no GPU) at 1280x720 runs at about 2 FPS
with 1.4 ms of CPU per frame, 51 draws and 321k triangles (Ceiling active), so the software GPU is the limit.

## Reviewed

- [x] **The automatic warp sequence over a long ride** (contact sheet, seeds 4242 and 12345, 0 to 12.4 km
      every 210 m). No combination looked broken. The busiest, such as Twist 0.96 with Rise 0.68
      (seed 12345, `at=4620`) or Roll 0.74 into a narrow tube (12345, `at=5460`), stay readable. Long calm
      stretches happen (4242 from 8,820 to 10,080 m).
- [x] **The mirrored Ceiling warp.** At full strength, tall pillars from the main world pierce the mirrored
      layer and join floor to ceiling; it reads as deliberate. During the fade-in (Ceiling under 0.35) a pale
      fog-coloured wedge of the mirrored world shows in the sky (4242, `at=7260`); subtle. The keyframe rule
      that keeps Ceiling out of a closed tube does not cover blends between keyframes (4242, `at=7220` mixes
      Roll 0.46 with Ceiling 0.09), but those frames look fine. Its cost (double draws and triangles) is still
      unmeasured on real GPUs.

## Known issues

- [ ] **Speckled ground and a two-tone road under warps** (inherited from the prototype). The terrain fragment
      shader flips the derivative normal when `normal.z < 0`, but `cross(dFdx(p), dFdy(p))` already faces the
      camera. On floors and roads the normal's z is near 0, so float noise flips pixels between lit and unlit:
      per-pixel speckle under Roll (4242, `at=2520`; 4242, `at=10290`), a road split into light and dark
      halves under Twist (4242, `at=7980`), and faint streaks even on calm stretches. Removing the flip fixed
      all of these in a test build without changing anything else visible. It changes the look, so it waits
      for the owner's go-ahead.
- [ ] Under Pinch and Roll, warped ground quads stop being flat and each triangle takes its own shade, giving a
      triangle checkerboard (4242, `at=8400`). A property of flat derivative normals; may be fine as a style.

## Deferred refactors and ideas (not for the port)

- [ ] The vertex cap (200,000 per chunk) is far above real use: across many seeds the largest chunk seen was
      about 26,400 vertices. The shared index buffer (1.2 million 32-bit indices, about 4.8 MB) could shrink.
- [ ] `BiomeKeyframes.at` allocates a new `Float32Array` per call (18 per chunk build, 1 per frame).
- [ ] Keyframe caches grow forever over a long ride (one entry per 420 or 640 blocks). Negligible for now.
- [ ] Self-host the two fonts to drop the Google Fonts dependency.
- [ ] Move to Vitest 4.1 or later once npm resolves its peer dependencies without crashing.
