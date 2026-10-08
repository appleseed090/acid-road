import { WAVE_FREQUENCY } from "../world/constants";

/**
 * Warps the static world as a function of each vertex's distance ahead of the camera. Uniform order of the
 * warp strengths matches {@link WARPS}; Ceiling is applied by drawing the world a second time mirrored.
 */
export const TERRAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec4 aColor;
layout(location=2) in vec3 aNormal;
uniform mat4 uProjection;
uniform float uChunkZ, uEyeHeight, uHalfWidth, uWavePhase, uMirror, uCeilingY, uFogEnd;
uniform float uTwist, uRoll, uRise, uSwerve, uWave, uStretch, uPinch;
out vec3 vViewPosition; out vec4 vColor; out float vFaceShade; out float vFog;
void main() {
  vec3 p = vec3(aPosition.xy, aPosition.z + uChunkZ);
  float ahead = max(p.z, 0.0);          // every warp grows with distance ahead, so the world unrolls as you reach it
  vFog = max(smoothstep(uFogEnd * 0.35, uFogEnd, length(p.xz)), smoothstep(uHalfWidth * 0.6, uHalfWidth * 0.98, abs(p.x)));

  p.y *= 1.0 + uStretch * (uStretch > 0.0 ? 2.5 : 0.9) * smoothstep(8.0, 160.0, ahead);
  p.y += uWave * smoothstep(0.0, 40.0, ahead) * (5.0 * sin(p.z * ${WAVE_FREQUENCY.toFixed(3)} + uWavePhase) * cos(p.x * 0.035) + 2.0 * sin(p.x * 0.11 + p.z * 0.02 + uWavePhase));
  p.x *= max(0.12, 1.0 + uPinch * ahead * 0.006);

  float curvature = uRoll * 3.14159265 / uHalfWidth;   // 1.0 closes the land into a full tube overhead
  if (abs(curvature) > 1e-5) {
    float radius = 1.0 / curvature;
    float r = radius * exp(clamp(-p.y / radius, -4.0, 3.0)); // heights shrink toward the axis instead of crossing it
    float angle = clamp(p.x / radius, -3.3, 3.3);
    p.x = r * sin(angle); p.y = radius - r * cos(angle);
  }
  if (uMirror > 0.5) p.y = uCeilingY - p.y;

  float twist = uTwist * ahead * 0.011, c = cos(twist), s = sin(twist);
  vec2 aroundEye = vec2(p.x, p.y - uEyeHeight);
  aroundEye = vec2(c * aroundEye.x - s * aroundEye.y, s * aroundEye.x + c * aroundEye.y);
  aroundEye += vec2(uSwerve, uRise) * ahead * ahead * 0.0016;

  vViewPosition = vec3(aroundEye, -p.z);
  vColor = aColor;
  vFaceShade = 0.62 + 0.38 * aNormal.y * step(0.0, aNormal.y) + 0.14 * abs(aNormal.z) + 0.05 * abs(aNormal.x);
  gl_Position = uProjection * vec4(vViewPosition, 1.0);
}`;

export const TERRAIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vViewPosition; in vec4 vColor; in float vFaceShade; in float vFog;
uniform vec3 uFogColor; uniform float uLight, uMirrorFade;
out vec4 outColor;
void main() {
  // The stored normals are wrong once the mesh is warped, so take the true face normal from the warped surface.
  vec3 normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  if (normal.z < 0.0) normal = -normal;
  float diffuse = max(dot(normal, normalize(vec3(0.35, 0.8, 0.45))), 0.0);
  vec3 lit = vColor.rgb * vFaceShade * mix(0.6, 1.15, diffuse) * uLight;
  vec3 color = mix(lit, vColor.rgb * 1.35, vColor.a);
  float fog = max(vFog * (1.0 - 0.45 * vColor.a), uMirrorFade);
  outColor = vec4(mix(color, uFogColor, fog), 1.0);
}`;

/** Full-screen triangle generated from gl_VertexID; needs no vertex buffers. */
export const SKY_VERTEX_SHADER = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

export const SKY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uResolution; uniform vec3 uFogColor, uZenithColor;
out vec4 outColor;
void main() {
  // Radial rather than top-to-bottom, so the sky still reads correctly when the world is twisted or rolled.
  vec2 fromCentre = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float t = smoothstep(0.05, 1.3, length(fromCentre));
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 255.0;
  outColor = vec4(mix(uFogColor, uZenithColor, t) + grain, 1.0);
}`;

export const TERRAIN_UNIFORMS = [
  "uProjection", "uChunkZ", "uEyeHeight", "uHalfWidth", "uWavePhase", "uMirror", "uCeilingY", "uFogEnd",
  "uTwist", "uRoll", "uRise", "uSwerve", "uWave", "uStretch", "uPinch", "uFogColor", "uLight", "uMirrorFade",
] as const;

export const SKY_UNIFORMS = ["uResolution", "uFogColor", "uZenithColor"] as const;
