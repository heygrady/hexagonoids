import {
  type Scene,
  type AbstractMesh,
  TransformNode,
  MeshBuilder,
  Color3,
} from '@babylonjs/core'
import QuickLRU from 'quick-lru'

import { getCommonMaterial } from '../common/commonMaterial'
import { CELL_CACHE_SIZE, RADIUS } from '../constants'

export const cellMarkersCache = new QuickLRU<
  string,
  AbstractMesh[] | TransformNode[]
>({
  maxSize: CELL_CACHE_SIZE,
  onEviction(key, value) {
    value.forEach((v) => {
      v.dispose()
    })
  },
})

export const createCellMarker = (
  scene: Scene,
  id: string,
  i: number,
  diameter?: number
) => {
  const cellId = `${id}_${i}`

  const cellMarker = MeshBuilder.CreateSphere(
    `cellMarker_${cellId}`,
    { diameter: diameter ?? 0.015 },
    scene
  )

  cellMarker.material = getCommonMaterial(scene, {
    diffuseColor: Color3.Yellow(),
    specularColor: Color3.White(),
    emissiveColor: Color3.Yellow(),
  }).clone(`cellMarkerMaterial_${cellId}`)

  return cellMarker
}

export let cellMarkerOrigin: TransformNode

export const getCellMarkers = (
  scene: Scene,
  id: string,
  withOrigin: boolean = false,
  radius: number = RADIUS
) => {
  if (cellMarkerOrigin === undefined) {
    cellMarkerOrigin = new TransformNode('cellMarkerOrigin')

    const globe = scene.getMeshByName('globe')
    if (globe != null) {
      cellMarkerOrigin.parent = globe
    }
  }

  let markers: AbstractMesh[] | TransformNode[] | undefined =
    cellMarkersCache.get(id)
  if (markers == null) {
    markers = [] as TransformNode[]
    for (let i = 0; i < 6; i++) {
      const marker = createCellMarker(scene, id, i)
      if (withOrigin) {
        const originNode = new TransformNode(
          `cellMarkerOrigin_${id}_${i}`,
          scene
        )
        marker.parent = originNode
        originNode.parent = cellMarkerOrigin
        marker.position.y = radius
        markers.push(originNode)
      } else {
        marker.parent = cellMarkerOrigin
        markers.push(marker)
      }
      cellMarkersCache.set(id, markers)
    }
  }

  return markers
}
