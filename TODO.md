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
      - Safari on a Mac, "Apple GPU", 2880x1640 canvas at 2x: 60 FPS (display cap), 16.7 ms frames, worst
        18.0; CPU 0.5 ms/frame; 26 draws, 211k triangles; chunks 1.0 ms each. Calm stretch, no Ceiling.
      - Same Mac, Ceiling 0.85 with Twist 0.15 (seed 2026, ~2,230 m): 60 FPS, 16.7 ms frames, worst 21.0;
        CPU 0.6 ms/frame, worst 6.0; 51 draws, 343k triangles; chunks 3.0 ms each. The double draw costs no
        frames. Still to measure: a discrete or older integrated GPU.
- [ ] **Frame rate on phones** (iOS Safari, Android Chrome), the same way. Every chunk is drawn every frame
      with no culling, and the Ceiling warp doubles that.
      - iPhone, "Apple GPU", WebKit (in-app browser), canvas 640x1104 (device 3x, rendering capped at 2x):
        - Ceiling about 0.7 plus Twist (seed 2026, ~2,320 m): 59.9 FPS, 16.7 ms frames, worst 17.0; CPU
          0.8 ms/frame, worst 6.0; 51 draws, 345k triangles; chunks 4.0 ms each. The double draw costs no frames.
        - Heavy Roll (seed 12345, ~5,540 m): 52.7 FPS in a window holding one 138 ms frame; the other frames
          averaged 16.7 ms. CPU (worst 8 ms) and chunk builds (worst 1 ms) did not cause it. It came about
          1.7 s after load. Still to check: does it recur over 30 s, or only happen once after load?
      - Still to measure: Android Chrome, and an older or weaker phone.

So far no device has needed performance work; the deferred optimisations below can wait for a device that
does.

Baseline, for comparison only: headless Chromium on SwiftShader (no GPU) at 1280x720 runs at about 2 FPS
with 1.4 ms of CPU per frame, 51 draws and 321k triangles (Ceiling active), so the software GPU is the limit.

## Reviewed

- [x] **The automatic warp sequence over a long ride** (contact sheet, seeds 4242, 12345, 777 and 2026, 0 to
      12.4 km every 210 m). No combination looked broken. The busiest, such as Twist 0.96 with Rise 0.68
      (seed 12345, `at=4620`) or Roll 0.74 into a narrow tube (12345, `at=5460`), stay readable. Long calm
      stretches happen (4242 from 8,820 to 10,080 m), but over 200 seeds x 50 km the ride is fully calm only
      5% of the distance; each warp is active (above 0.05) for 28 to 30% of it.
- [x] **The mirrored Ceiling warp.** At full strength, tall pillars from the main world pierce the mirrored
      layer and join floor to ceiling; it reads as deliberate. The keyframe rule that keeps Ceiling out of a
      closed tube does not cover blends between keyframes (4242, `at=7220` mixes Roll 0.46 with Ceiling 0.09),
      but those frames look fine. Its double draw (51 draws, ~345k triangles) holds 60 FPS on the Mac and iPhone
      measured above.
- [x] **Ceiling fade-in and the ceiling's far edge.** Distant and fading terrain faded toward a flat fog colour,
      which matches the sky only at the screen centre. The mirrored ceiling showed as a pale slab while fading in,
      and its fogged far edge showed as a blocky shape that jumped 16 blocks forward with every new chunk. Terrain
      now fades into the sky shader's colour at each pixel. Calm rides change on about 0.2% of pixels; a full
      Ceiling's distant sides now take the deeper sky colour behind them.
- [x] **Ceiling frequency** stays as it is (about 28% of the road, like every warp): the owner prefers it. A
      "keep a drawn Ceiling half the time" rule (16.8%) was prototyped and declined.
- [x] **Triangle checkerboard on warped ground** (4242, `at=8400`). Not a separate effect: the derivative-normal
      flip lit one triangle of each bent quad and darkened the other. Gone since that flip was removed; per-vertex
      warped normals were prototyped and change under 0.1% of pixels now, so they are not needed.

## Deferred refactors and ideas (not for the port)

- [ ] The vertex cap (200,000 per chunk) is far above real use: across many seeds the largest chunk seen was
      about 26,400 vertices. The shared index buffer (1.2 million 32-bit indices, about 4.8 MB) could shrink.
- [ ] `BiomeKeyframes.at` allocates a new `Float32Array` per call (18 per chunk build, 1 per frame).
- [ ] Keyframe caches grow forever over a long ride (one entry per 420 or 640 blocks). Negligible for now.
- [ ] Self-host the two fonts to drop the Google Fonts dependency.
- [ ] Move to Vitest 4.1 or later once npm resolves its peer dependencies without crashing.
