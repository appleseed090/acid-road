import { BiomeKeyframes } from "./biomes";
import { WarpDirector } from "./warps";

/** Everything that follows from one seed. Two worlds with the same seed give the same ride. */
export class World {
  readonly biomes: BiomeKeyframes;
  readonly warps: WarpDirector;

  constructor(readonly seed: number) {
    this.biomes = new BiomeKeyframes(seed);
    this.warps = new WarpDirector(seed);
  }
}
