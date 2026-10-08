/**
 * Column-major perspective matrix. The view angle applies to the longer screen side, so a phone held
 * upright keeps the same sense of speed as a landscape screen.
 */
export function projectionMatrix(fovDegrees: number, aspect: number): Float32Array {
  const f = 1 / Math.tan(fovDegrees * Math.PI / 360), near = 0.2, far = 3000;
  const scaleX = aspect >= 1 ? f : f / aspect, scaleY = aspect >= 1 ? f * aspect : f;
  return new Float32Array([scaleX, 0, 0, 0, 0, scaleY, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
