import {
  PolygonMeshBuilder,
  type Scene,
  Vector2,
  type Mesh,
} from '@babylonjs/core'
import earcut from 'earcut'

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
  segment1Mesh: Mesh,
  segment2Mesh: Mesh,
  segment3Mesh: Mesh,
]

export const createSegmentPolygons = (
  scene: Scene,
  id: string
): SegmentPolygons => {
  const segment1Builder = new PolygonMeshBuilder(
    `shipSegment1_${id}`,
    segment1Contours,
    scene,
    earcut
  )
  const segment2Builder = new PolygonMeshBuilder(
    `shipSegment2_${id}`,
    segment2Contours,
    scene,
    earcut
  )
  const segment3Builder = new PolygonMeshBuilder(
    `shipSegment3_${id}`,
    segment3Contours,
    scene,
    earcut
  )

  const segment1Mesh = segment1Builder.build()
  const segment2Mesh = segment2Builder.build()
  const segment3Mesh = segment3Builder.build()

  return [segment1Mesh, segment2Mesh, segment3Mesh]
}
