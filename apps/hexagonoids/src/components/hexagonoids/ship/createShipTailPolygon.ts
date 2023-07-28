import { PolygonMeshBuilder, Vector2, type Scene } from '@babylonjs/core'
import earcut from 'earcut'

export const createShipTailPolygon = (scene: Scene, id: string) => {
  const tail = new PolygonMeshBuilder(
    `shipTail_${id}`,
    [new Vector2(-24, -16), new Vector2(-56, 0), new Vector2(-24, 16)],
    scene,
    earcut
  )
  tail.addHole([new Vector2(-24, -8), new Vector2(-40, 0), new Vector2(-24, 8)])
  const polygon = tail.build()
  return polygon
}
