import "./style.css";
import { Renderer } from "./render/renderer";
import { Controls } from "./ui/controls";
import { parseRideParams, urlForRide } from "./ui/rideParams";
import { StatsOverlay } from "./ui/statsOverlay";
import { biomeColor, BiomeColor, BiomeNumber } from "./world/biomes";
import { ChunkMeshBuilder } from "./world/chunkMesh";
import { CHUNK_COUNT } from "./world/constants";
import { randomSeed } from "./world/random";
import { WARP_COUNT } from "./world/warps";
import { World } from "./world/world";

/** How far ahead of the camera the sky and fog take their colour from, so they change before you arrive. */
const SKY_LOOKAHEAD = 120;

function showFailure(message: string): void {
  const box = document.getElementById("fail");
  if (!box) throw new Error("index.html is missing #fail");
  box.textContent = message;
  box.hidden = false;
}

/** Keeps the address bar a shareable link to the current world without adding history entries. */
function showRideInUrl(seed: number, startTravel: number): void {
  history.replaceState(history.state, "", urlForRide(location.href, seed, startTravel));
}

function start(): void {
  const canvas = document.getElementById("view");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("index.html is missing canvas#view");
  const result = Renderer.create(canvas, new ChunkMeshBuilder());
  if (!result.ok) {
    if (result.reason === "no-webgl2") {
      showFailure("This needs WebGL 2, which this browser or device has turned off. Try a current desktop or phone browser.");
    } else {
      console.error(result.error);
      showFailure("The graphics shaders did not compile on this device, so the ride cannot start.");
    }
    return;
  }
  const renderer = result.renderer;

  const params = parseRideParams(location.search);
  for (const problem of params.problems) console.warn(problem);
  let world = new World(params.seed ?? randomSeed());
  let travel = params.startTravel;
  showRideInUrl(world.seed, travel);

  const controls = new Controls(() => {
    world = new World(randomSeed());
    travel = 0;
    showRideInUrl(world.seed, travel);
    renderer.clearChunks();
    renderer.streamChunks(world, travel, CHUNK_COUNT);
  });
  const stats = params.showStats ? new StatsOverlay() : null;
  const deviceInfo = () => ({ gpu: renderer.describeGpu(), canvasWidth: canvas.width, canvasHeight: canvas.height });

  // Start with the warps already at the starting point's values, so a ride opened mid-road (?at=) shows that
  // point as it really looks instead of easing in from flat. At distance 0 every warp is 0 either way.
  const targetWarps = new Float32Array(WARP_COUNT), liveWarps = new Float32Array(WARP_COUNT);
  world.warps.directedWarps(travel, liveWarps);
  let previousTime = performance.now(), frameNumber = 0;

  function frame(now: number): void {
    const frameStart = performance.now(), intervalMs = now - previousTime;
    const dt = Math.min(0.05, intervalMs / 1000);
    previousTime = now;
    if (controls.playing) travel += controls.speed * dt;
    const chunksBuilt = renderer.streamChunks(world, travel, 2);
    const chunkBuildMs = performance.now() - frameStart;

    if (controls.manualWarps) controls.readManualWarps(targetWarps);
    else world.warps.directedWarps(travel, targetWarps);
    const ease = 1 - Math.exp(-dt * 6); // only matters when you grab a slider or switch modes; the director is already smooth
    for (let i = 0; i < WARP_COUNT; i++) liveWarps[i] += (targetWarps[i] - liveWarps[i]) * ease;
    if (frameNumber++ % 4 === 0) controls.showState(liveWarps, travel);

    const biome = world.biomes.at(travel + SKY_LOOKAHEAD);
    const drawStats = renderer.draw({
      travel,
      warps: liveWarps,
      strength: controls.strength,
      fovDegrees: controls.fovDegrees,
      fogColor: biomeColor(biome, BiomeColor.FOG),
      zenithColor: biomeColor(biome, BiomeColor.ZENITH),
      light: biome.numbers[BiomeNumber.LIGHT],
    });
    stats?.record({ intervalMs, cpuMs: performance.now() - frameStart, ...drawStats, chunksBuilt, chunkBuildMs }, deviceInfo);
    requestAnimationFrame(frame);
  }

  renderer.streamChunks(world, travel, CHUNK_COUNT);
  requestAnimationFrame(frame);
}

start();
