import { Vector2 } from '@babylonjs/core/Maths/math.vector'
import { type InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { PolygonMeshBuilder } from '@babylonjs/core/Meshes/polygonMesh'
import type { Scene } from '@babylonjs/core/scene'
import earcut from 'earcut'

import { getCommonMaterial } from '../common/commonMaterial'

const segment1Contours = [
  new Vector2(-40, -32),
  new Vector2(18, -12),
  new Vector2(18, -4),
  new Vector2(-16, -14),
  new Vector2(-16, -4),
  new Vector2(-24, -6),
  new Vector2(-24, -16),
]

const segment2Contours = [
  new Vector2(-24, -6),
  new Vector2(-16, -4),
  new Vector2(-16, 24),
  new Vector2(-40, 32),
  new Vector2(-24, 16),
]

const segment3Contours = [
  new Vector2(-16, 24),
  new Vector2(56, 0),
  new Vector2(18, -12),
  new Vector2(18, -4),
  new Vector2(32, 0),
  new Vector2(-16, 14),
]

export type SegmentPolygons = [
  segment1Mesh: InstancedMesh,
  segment2Mesh: InstancedMesh,
  segment3Mesh: InstancedMesh,
]

let segmentMasters: [Mesh, Mesh, Mesh] | null = null

/**
 * Initialize the segment master meshes. This should be called once when the scene is set up.
 * Creates 3 master meshes (one for each segment shape) that will be used to create segment instances.
 * @param {Scene} scene - The scene
 */
export const initializeSegmentMasters = (scene: Scene): void => {
  if (segmentMasters !== null) {
    return // Already initialized
  }

  const segment1Builder = new PolygonMeshBuilder(
    'segmentMaster1',
    segment1Contours,
    scene,
    earcut
  )
  const segment1Master = segment1Builder.build()
  segment1Master.isVisible = false
  segment1Master.material = getCommonMaterial(scene)

  const segment2Builder = new PolygonMeshBuilder(
    'segmentMaster2',
    segment2Contours,
    scene,
    earcut
  )
  const segment2Master = segment2Builder.build()
  segment2Master.isVisible = false
  segment2Master.material = getCommonMaterial(scene)

  const segment3Builder = new PolygonMeshBuilder(
    'segmentMaster3',
    segment3Contours,
    scene,
    earcut
  )
  const segment3Master = segment3Builder.build()
  segment3Master.isVisible = false
  segment3Master.material = getCommonMaterial(scene)

  segmentMasters = [segment1Master, segment2Master, segment3Master]
}

/**
 * Create segment polygons for a ship.
 * @param {Scene} scene - The scene
 * @param {string} id - The ship ID
 * @returns {SegmentPolygons} The created segment polygons
 */
export const createSegmentPolygons = (
  scene: Scene,
  id: string
): SegmentPolygons => {
  // Lazy initialization: create masters on first call if not already initialized
  if (segmentMasters === null) {
    initializeSegmentMasters(scene)
  }

  // Create instances of the master meshes
  if (segmentMasters == null) {
    throw new Error('Segment masters not initialized')
  }
  const segment1Mesh = segmentMasters[0].createInstance(`shipSegment1_${id}`)
  const segment2Mesh = segmentMasters[1].createInstance(`shipSegment2_${id}`)
  const segment3Mesh = segmentMasters[2].createInstance(`shipSegment3_${id}`)

  return [segment1Mesh, segment2Mesh, segment3Mesh]
}
