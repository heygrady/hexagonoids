/**
 * Convert engine yaw (0 = East / Forward) to geographic bearing (0 = North).
 * The engine's default heading (yaw 0) corresponds to East (bearing PI/2)
 * because BabylonJS Vector3.Forward() points along +Z.
 */
export function yawToBearing(yaw: number): number {
  return Math.PI / 2 + yaw
}
