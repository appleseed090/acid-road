import "./style.css";
import { Renderer } from "./render/renderer";
import { Controls } from "./ui/controls";
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

  let world = new World(randomSeed());
  let travel = 0;
  const controls = new Controls(() => {
    world = new World(randomSeed());
    travel = 0;
    renderer.clearChunks();
    renderer.streamChunks(world, travel, CHUNK_COUNT);
  });

  const targetWarps = new Float32Array(WARP_COUNT), liveWarps = new Float32Array(WARP_COUNT);
  let previousTime = performance.now(), frameNumber = 0;

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - previousTime) / 1000);
    previousTime = now;
    if (controls.playing) travel += controls.speed * dt;
    renderer.streamChunks(world, travel, 2);

    if (controls.manualWarps) controls.readManualWarps(targetWarps);
    else world.warps.directedWarps(travel, targetWarps);
    const ease = 1 - Math.exp(-dt * 6); // only matters when you grab a slider or switch modes; the director is already smooth
    for (let i = 0; i < WARP_COUNT; i++) liveWarps[i] += (targetWarps[i] - liveWarps[i]) * ease;
    if (frameNumber++ % 4 === 0) controls.showState(liveWarps, travel);

    const biome = world.biomes.at(travel + SKY_LOOKAHEAD);
    renderer.draw({
      travel,
      warps: liveWarps,
      strength: controls.strength,
      fovDegrees: controls.fovDegrees,
      fogColor: biomeColor(biome, BiomeColor.FOG),
      zenithColor: biomeColor(biome, BiomeColor.ZENITH),
      light: biome.numbers[BiomeNumber.LIGHT],
    });
    requestAnimationFrame(frame);
  }

  renderer.streamChunks(world, travel, CHUNK_COUNT);
  requestAnimationFrame(frame);
}

start();
