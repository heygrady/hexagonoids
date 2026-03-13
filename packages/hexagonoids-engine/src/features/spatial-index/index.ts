import QuickLRU from 'quick-lru'
import {
  RADIUS,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
} from '../engine/constants.js'
import type {
  BulletState,
  EntityType,
  GameState,
  RockState,
  ShipState,
} from '../engine/types.js'

export type SpatialIndexResolution = 0 | 1 | 2 | 3

export interface SpatialPoint {
  x: number
  y: number
  z: number
}

export interface SpatialEntityRef {
  id: string
  type: EntityType
}

export interface SpatialIndexEntity {
  id: string
  type: EntityType
  point: SpatialPoint
  entity: ShipState | RockState | BulletState
}

export interface SpatialShipEntity extends SpatialIndexEntity {
  type: 'ship'
  entity: ShipState
}

export interface SpatialRockEntity extends SpatialIndexEntity {
  type: 'rock'
  entity: RockState
}

export interface SpatialBulletEntity extends SpatialIndexEntity {
  type: 'bullet'
  entity: BulletState
}

export interface QueryEntitiesOptions {
  center: SpatialPoint
  radius: number
  resolution: SpatialIndexResolution
  type?: EntityType | undefined
  types?: EntityType[] | undefined
}

export interface QueryCellsOptions {
  center: SpatialPoint
  radius: number
  resolution: SpatialIndexResolution
}

interface BucketSystem {
  count: number
  points: Float64Array
  coveringAngle: number
}

interface SpatialIndexEntitiesByType {
  ship: SpatialShipEntity[]
  rock: SpatialRockEntity[]
  bullet: SpatialBulletEntity[]
}

const DEG_TO_RAD = Math.PI / 180
const PHI = (1 + Math.sqrt(5)) / 2
const QUERY_CELLS_CACHE_SIZE = 512
const queryCellsCache = new QuickLRU<string, readonly number[]>({
  maxSize: QUERY_CELLS_CACHE_SIZE,
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z)
  return [x / len, y / len, z / len]
}

function dot(a: SpatialPoint, b: SpatialPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function angularDistanceFromDot(dotValue: number): number {
  return Math.acos(clamp(dotValue, -1, 1))
}

function latLngToUnitPoint(lat: number, lng: number): SpatialPoint {
  const latRad = lat * DEG_TO_RAD
  const lngRad = lng * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  return {
    x: cosLat * Math.cos(lngRad),
    y: Math.sin(latRad),
    z: cosLat * Math.sin(lngRad),
  }
}

function createBaseIcosahedron(): {
  verts: [number, number, number][]
  faces: [number, number, number][]
} {
  const raw: [number, number, number][] = [
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ]

  const verts = raw.map(([x, y, z]) => normalize(x, y, z))
  const faces: [number, number, number][] = [
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

  return { verts, faces }
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

function buildBucketSystem(levels: number): BucketSystem {
  const { verts, faces: baseFaces } = createBaseIcosahedron()
  let faces = baseFaces

  for (let i = 0; i < levels; i++) {
    faces = subdivideOnce(verts, faces)
  }

  const used = new Set<number>()
  for (const [a, b, c] of faces) {
    used.add(a)
    used.add(b)
    used.add(c)
  }

  const ordered = Array.from(used).sort((a, b) => a - b)
  const points = new Float64Array(ordered.length * 3)
  for (let i = 0; i < ordered.length; i++) {
    const v = verts[ordered[i]!]!
    points[i * 3] = v[0]
    points[i * 3 + 1] = v[1]
    points[i * 3 + 2] = v[2]
  }

  let nearestAngle = Math.PI
  for (let i = 0; i < ordered.length; i++) {
    const ax = points[i * 3]!
    const ay = points[i * 3 + 1]!
    const az = points[i * 3 + 2]!
    for (let j = i + 1; j < ordered.length; j++) {
      const bx = points[j * 3]!
      const by = points[j * 3 + 1]!
      const bz = points[j * 3 + 2]!
      const angle = angularDistanceFromDot(ax * bx + ay * by + az * bz)
      if (angle < nearestAngle) {
        nearestAngle = angle
      }
    }
  }

  return {
    count: ordered.length,
    points,
    // Half the nearest-centroid spacing is a useful cover radius approximation.
    coveringAngle: nearestAngle * 0.5,
  }
}

const BUCKET_SYSTEMS: Record<SpatialIndexResolution, BucketSystem> = {
  0: buildBucketSystem(0),
  1: buildBucketSystem(1),
  2: buildBucketSystem(2),
  3: buildBucketSystem(3),
}

/** Default icosahedral bucket system used for coarse spatial coverage tracking. */
export const BUCKET_SYSTEM = BUCKET_SYSTEMS[2]

function findBucketIndex(
  point: SpatialPoint,
  resolution: SpatialIndexResolution
): number {
  const system = BUCKET_SYSTEMS[resolution]
  const pts = system.points
  let bestDot = -Infinity
  let bestIdx = 0
  for (let i = 0; i < system.count; i++) {
    const off = i * 3
    const score =
      point.x * pts[off]! + point.y * pts[off + 1]! + point.z * pts[off + 2]!
    if (score > bestDot) {
      bestDot = score
      bestIdx = i
    }
  }
  return bestIdx
}

/**
 * Find the nearest default (resolution 2) bucket index for a point on the unit sphere.
 * Input must be unit-length (x^2 + y^2 + z^2 ~= 1).
 */
export function findBucketXYZ(px: number, py: number, pz: number): number {
  return findBucketIndex({ x: px, y: py, z: pz }, 2)
}

function normalizeTypes(
  type: EntityType | undefined,
  types: EntityType[] | undefined
): Set<EntityType> | null {
  if (type == null && (types == null || types.length === 0)) {
    return null
  }
  const set = new Set<EntityType>()
  if (type != null) set.add(type)
  if (types != null) {
    for (const value of types) set.add(value)
  }
  return set
}

export class SpatialIndex {
  public readonly sphereRadius: number
  private readonly entitiesByType: SpatialIndexEntitiesByType

  constructor(entities: SpatialIndexEntity[], sphereRadius = RADIUS) {
    this.sphereRadius = sphereRadius
    this.entitiesByType = {
      ship: [],
      rock: [],
      bullet: [],
    }

    for (const entity of entities) {
      if (entity.type === 'ship') {
        this.entitiesByType.ship.push(entity as SpatialShipEntity)
      } else if (entity.type === 'rock') {
        this.entitiesByType.rock.push(entity as SpatialRockEntity)
      } else {
        this.entitiesByType.bullet.push(entity as SpatialBulletEntity)
      }
    }
  }

  queryCells(
    center: SpatialPoint,
    radius: number,
    resolution: SpatialIndexResolution
  ): readonly number[] {
    const system = BUCKET_SYSTEMS[resolution]
    const angularRadius = radius / this.sphereRadius
    const sourceBucketId = findBucketIndex(center, resolution)
    const radiusBand = this.getRadiusBand(angularRadius, system.coveringAngle)
    const cacheKey = `${resolution}:${sourceBucketId}:${radiusBand}`
    const cached = queryCellsCache.get(cacheKey)
    if (cached != null) {
      return cached
    }

    const sourceOffset = sourceBucketId * 3
    const sourceCenter: SpatialPoint = {
      x: system.points[sourceOffset]!,
      y: system.points[sourceOffset + 1]!,
      z: system.points[sourceOffset + 2]!,
    }
    const bandRadius = radiusBand * this.getRadiusBandStep(system.coveringAngle)
    const maxAngle = bandRadius + system.coveringAngle * 2
    const minDot = Math.cos(Math.min(maxAngle, Math.PI))
    const pts = system.points
    const matches: number[] = []

    for (let i = 0; i < system.count; i++) {
      const off = i * 3
      const score =
        sourceCenter.x * pts[off]! +
        sourceCenter.y * pts[off + 1]! +
        sourceCenter.z * pts[off + 2]!
      if (score >= minDot) {
        matches.push(i)
      }
    }

    queryCellsCache.set(cacheKey, matches)
    return matches
  }

  queryEntities(
    center: SpatialPoint,
    radius: number,
    type?: EntityType,
    types?: EntityType[]
  ): SpatialIndexEntity[] {
    if (type != null) {
      return this.queryTypedEntitiesNear(center, radius, type)
    }
    if (types != null && types.length === 1) {
      return this.queryTypedEntitiesNear(center, radius, types[0]!)
    }

    const minDot = Math.cos(radius / this.sphereRadius)
    const results: SpatialIndexEntity[] = []
    const allowedTypes = normalizeTypes(type, types)

    if (allowedTypes == null || allowedTypes.has('ship')) {
      this.scanTypedEntitiesNear(
        this.entitiesByType.ship,
        center,
        minDot,
        results
      )
    }
    if (allowedTypes == null || allowedTypes.has('rock')) {
      this.scanTypedEntitiesNear(
        this.entitiesByType.rock,
        center,
        minDot,
        results
      )
    }
    if (allowedTypes == null || allowedTypes.has('bullet')) {
      this.scanTypedEntitiesNear(
        this.entitiesByType.bullet,
        center,
        minDot,
        results
      )
    }

    return results
  }

  queryShipsNear(center: SpatialPoint, radius: number): SpatialShipEntity[] {
    return this.queryTypedEntitiesNear(center, radius, 'ship')
  }

  queryRocksNear(center: SpatialPoint, radius: number): SpatialRockEntity[] {
    return this.queryTypedEntitiesNear(center, radius, 'rock')
  }

  queryRocksIntersect(
    center: SpatialPoint,
    radius: number
  ): SpatialRockEntity[] {
    const smallDot = Math.cos((radius + ROCK_SMALL_RADIUS) / this.sphereRadius)
    const mediumDot = Math.cos(
      (radius + ROCK_MEDIUM_RADIUS) / this.sphereRadius
    )
    const largeDot = Math.cos((radius + ROCK_LARGE_RADIUS) / this.sphereRadius)
    const results: SpatialRockEntity[] = []

    for (const rock of this.entitiesByType.rock) {
      const thresholdDot =
        rock.entity.size === 2
          ? largeDot
          : rock.entity.size === 1
            ? mediumDot
            : smallDot
      if (dot(rock.point, center) >= thresholdDot) {
        results.push(rock)
      }
    }

    return results
  }

  findFirstRockIntersect(
    center: SpatialPoint,
    radius: number
  ): SpatialRockEntity | undefined {
    const smallDot = Math.cos((radius + ROCK_SMALL_RADIUS) / this.sphereRadius)
    const mediumDot = Math.cos(
      (radius + ROCK_MEDIUM_RADIUS) / this.sphereRadius
    )
    const largeDot = Math.cos((radius + ROCK_LARGE_RADIUS) / this.sphereRadius)

    for (const rock of this.entitiesByType.rock) {
      const thresholdDot =
        rock.entity.size === 2
          ? largeDot
          : rock.entity.size === 1
            ? mediumDot
            : smallDot
      if (dot(rock.point, center) >= thresholdDot) {
        return rock
      }
    }
    return undefined
  }

  queryBulletsNear(
    center: SpatialPoint,
    radius: number
  ): SpatialBulletEntity[] {
    return this.queryTypedEntitiesNear(center, radius, 'bullet')
  }

  private queryTypedEntitiesNear<T extends EntityType>(
    center: SpatialPoint,
    radius: number,
    type: T
  ): Extract<SpatialIndexEntity, { type: T }>[] {
    const minDot = Math.cos(radius / this.sphereRadius)
    const results: Extract<SpatialIndexEntity, { type: T }>[] = []
    this.scanTypedEntitiesNear(
      this.entitiesByType[type] as Extract<SpatialIndexEntity, { type: T }>[],
      center,
      minDot,
      results
    )
    return results
  }

  private scanTypedEntitiesNear<T extends SpatialIndexEntity>(
    entities: readonly T[],
    center: SpatialPoint,
    minDot: number,
    results: T[]
  ): void {
    for (const entity of entities) {
      if (dot(entity.point, center) >= minDot) {
        results.push(entity)
      }
    }
  }

  private getRadiusBand(angularRadius: number, coveringAngle: number): number {
    const step = this.getRadiusBandStep(coveringAngle)
    return Math.max(0, Math.ceil(angularRadius / step))
  }

  private getRadiusBandStep(coveringAngle: number): number {
    return Math.max(coveringAngle * 0.25, 1e-6)
  }
}

function buildSpatialEntity(
  entity: ShipState | RockState | BulletState,
  type: EntityType
): SpatialIndexEntity {
  return {
    id: entity.id,
    type,
    point: entity,
    entity,
  }
}

export function buildSpatialIndex(
  state: GameState,
  sphereRadius = RADIUS
): SpatialIndex {
  const entities: SpatialIndexEntity[] = []

  for (const ship of state.ships.values()) {
    entities.push(buildSpatialEntity(ship, 'ship'))
  }
  for (const rock of state.rocks.values()) {
    entities.push(buildSpatialEntity(rock, 'rock'))
  }
  for (const bullet of state.bullets.values()) {
    entities.push(buildSpatialEntity(bullet, 'bullet'))
  }

  return new SpatialIndex(entities, sphereRadius)
}

export function getSpatialBucketCount(
  resolution: SpatialIndexResolution
): number {
  return BUCKET_SYSTEMS[resolution].count
}

export function latLngToSpatialPoint(lat: number, lng: number): SpatialPoint {
  return latLngToUnitPoint(lat, lng)
}

export function getSpatialBucketCoveringAngle(
  resolution: SpatialIndexResolution
): number {
  return BUCKET_SYSTEMS[resolution].coveringAngle
}
