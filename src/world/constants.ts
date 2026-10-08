/** Columns on each side of the road axis. The world spans x in [-HALF_WIDTH, HALF_WIDTH). */
export const HALF_WIDTH = 80;
export const COLUMNS_X = HALF_WIDTH * 2;
/** Blocks along the road per chunk. */
export const CHUNK_LENGTH = 16;
export const CHUNKS_AHEAD = 23;
export const CHUNKS_BEHIND = 1;
export const CHUNK_COUNT = CHUNKS_AHEAD + CHUNKS_BEHIND + 1;
export const EYE_HEIGHT = 2.6;
export const FOG_END = CHUNKS_AHEAD * CHUNK_LENGTH - 12;
/** Blocks between warp keyframes. */
export const WARP_SEGMENT_LENGTH = 420;
/** Blocks between scenery keyframes; deliberately different from the warp length so scenery and warps drift out of step. */
export const BIOME_SEGMENT_LENGTH = 640;
export const WAVE_FREQUENCY = 0.045;
/** Columns either side of the axis (measured from x + 0.5) that form the flat road. */
export const ROAD_HALF_WIDTH = 3;
