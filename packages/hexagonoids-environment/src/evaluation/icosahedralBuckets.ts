/**
 * Icosahedral bucketing for spatial coverage tracking.
 *
 * Subdivides an icosahedron twice to produce ~162 well-distributed reference
 * points on the unit sphere. Each ship position is assigned to the nearest
 * bucket via brute-force dot-product scan.
 */

interface BucketSystem {
  /** Number of buckets. */
  count: number
  /** Flat array of unit-length reference points: [x0, y0, z0, x1, y1, z1, ...] */
  points: Float64Array
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z)
  return [x / len, y / len, z / len]
}

function subdivideOnce(
  verts: [number, number, number][],
  faces: [number, number, number][]
): [number, number, number][] {
  const midpointCache = new Map<string, number>()

  function getMidpoint(a: number, b: number): number {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    const cached = midpointCache.get(key)
    if (cached != null) return cached

    const va = verts[a]!
    const vb = verts[b]!
    const mid = normalize(
      (va[0] + vb[0]) * 0.5,
      (va[1] + vb[1]) * 0.5,
      (va[2] + vb[2]) * 0.5
    )
    const idx = verts.length
    verts.push(mid)
    midpointCache.set(key, idx)
    return idx
  }

  const newFaces: [number, number, number][] = []
  for (const [a, b, c] of faces) {
    const ab = getMidpoint(a, b)
    const bc = getMidpoint(b, c)
    const ca = getMidpoint(c, a)
    newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca])
  }

  return newFaces
}

function buildSubdividedIcosahedron(levels: number): number[][] {
  // Golden ratio
  const phi = (1 + Math.sqrt(5)) / 2

  // 12 vertices of a regular icosahedron (normalized to unit sphere)
  const raw: [number, number, number][] = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ]

  const verts: [number, number, number][] = raw.map(([x, y, z]) =>
    normalize(x, y, z)
  )

  // 20 faces of the icosahedron (vertex indices)
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ]

  for (let i = 0; i < levels; i++) {
    faces = subdivideOnce(verts, faces)
  }

  // Collect unique vertex indices from final faces
  const usedSet = new Set<number>()
  for (const [a, b, c] of faces) {
    usedSet.add(a)
    usedSet.add(b)
    usedSet.add(c)
  }

  const points: number[][] = []
  for (const idx of usedSet) {
    const v = verts[idx]!
    points.push([v[0], v[1], v[2]])
  }
  return points
}

function buildBucketSystem(): BucketSystem {
  // 2 levels of subdivision: 12 → 42 → 162 vertices
  const points = buildSubdividedIcosahedron(2)
  const count = points.length
  const flat = new Float64Array(count * 3)
  for (let i = 0; i < count; i++) {
    const p = points[i]!
    flat[i * 3] = p[0]!
    flat[i * 3 + 1] = p[1]!
    flat[i * 3 + 2] = p[2]!
  }
  return { count, points: flat }
}

/** Precomputed bucket system with well-distributed reference points. */
export const BUCKET_SYSTEM: BucketSystem = buildBucketSystem()

/**
 * Find the nearest bucket index for a point on the unit sphere.
 * Input must be unit-length (x² + y² + z² ≈ 1).
 */
export function findBucketXYZ(px: number, py: number, pz: number): number {
  const pts = BUCKET_SYSTEM.points
  const n = BUCKET_SYSTEM.count
  let bestDot = -Infinity
  let bestIdx = 0
  for (let i = 0; i < n; i++) {
    const off = i * 3
    const dot = px * pts[off]! + py * pts[off + 1]! + pz * pts[off + 2]!
    if (dot > bestDot) {
      bestDot = dot
      bestIdx = i
    }
  }
  return bestIdx
}
