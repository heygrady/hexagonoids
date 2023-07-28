import { PolygonMeshBuilder, Vector2, type Scene } from '@babylonjs/core'
import earcut from 'earcut'

export const SHIP_POLYGON = [
  new Vector2(-40, 32),
  new Vector2(56, 0),
  new Vector2(-40, -32),
  new Vector2(-24, -16),
  new Vector2(-24, 16),
]

export const SHIP_HOLE_POLYGON = [
  new Vector2(-16, 14),
  new Vector2(32, 0),
  new Vector2(-16, -14),
]

export const createShipPolygon = (scene: Scene, id: string) => {
  const ship = new PolygonMeshBuilder(`ship_${id}`, SHIP_POLYGON, scene, earcut)
  ship.addHole(SHIP_HOLE_POLYGON)
  const polygon = ship.build()
  return polygon
}
