import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { latLngToVector3, vector3ToLatLng } from '@heygrady/h3-babylon'
import {
  restartGame,
  sampleSpawnBorderPoint,
  spawnWave,
} from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { cellToLatLng, latLngToCell } from 'h3-js'
import { onCleanup } from 'solid-js'

import { useScene } from '../../solid-babylon/hooks/useScene'
import { createCellPolygon } from '../cell/createCellPolygon'
import { DEFAULT_PLAYER_ID, RADIUS } from '../constants'
import { useGameLoop } from '../engine/useGameLoop'
import { useInputs } from '../engine/useInputBridge'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'
import { useAppMode } from './AppModeProvider'

const MARKER_RESOLUTION = 3
const MARKER_RADIUS = RADIUS + 0.06
const MARKER_COLOR = '#DC143C'
const BORDER_SAMPLE_POINTS = 64

function createMarker(
  globe: TransformNode,
  h: string,
  name: string
): TransformNode {
  const scene = globe.getScene()
  const originNode = new TransformNode(`${name}_origin`, scene)
  originNode.parent = globe

  const positionNode = new TransformNode(`${name}_position`, scene)
  positionNode.parent = originNode
  positionNode.position.y = RADIUS

  const [lat, lng] = cellToLatLng(h)
  const center = latLngToVector3(lat, lng, RADIUS)
  const [yaw, pitch] = getYawPitch(center)
  moveNodeTo(originNode, yaw, pitch)
  positionNode.computeWorldMatrix(true)

  const cellNode = createCellPolygon(scene, positionNode, h, MARKER_RADIUS)
  const material = new StandardMaterial(`${name}_material`, scene)
  material.diffuseColor = Color3.FromHexString(MARKER_COLOR)
  material.emissiveColor = Color3.FromHexString(MARKER_COLOR).scale(0.4)
  material.specularColor = Color3.Black()
  material.alpha = 0.9
  cellNode.material = material

  return originNode
}

export function SpawnDebugController() {
  const engine = useGameState()
  const inputs = useInputs()
  const scene = useScene()
  const { playerId } = useAppMode()
  const PLAYER_ID = playerId() || DEFAULT_PLAYER_ID

  useGameLoop(inputs, PLAYER_ID)

  const disposables = new Set<TransformNode>()

  // Start a fresh game snapshot for spawn debugging.
  inputs.reset()
  engine.mutate((state) => {
    restartGame(state, PLAYER_ID, engine.rng)
  })

  const player = engine.state.players.get(PLAYER_ID)
  const ship =
    player?.shipId != null ? engine.state.ships.get(player.shipId) : undefined
  if (ship == null) {
    console.warn('[SPAWN-DEBUG] Unable to find player ship')
    return null
  }

  // Snap camera to player at mode start.
  const cameraOriginNode = scene.getTransformNodeByName('shipCameraOrigin')
  if (cameraOriginNode instanceof TransformNode) {
    const pos = new Vector3(ship.x * RADIUS, ship.y * RADIUS, ship.z * RADIUS)
    const [yaw, pitch] = getYawPitch(pos)
    moveNodeTo(cameraOriginNode, yaw, pitch)
  }

  // Spawn the first wave immediately to inspect the initial spawn result.
  engine.mutate((state) => {
    spawnWave(state, { x: ship.x, y: ship.y, z: ship.z }, engine.rng)
  })

  const spawnedRocks = Array.from(engine.state.rocks.values())
  if (spawnedRocks.length === 0) {
    console.warn('[SPAWN-DEBUG] No rock spawned in first wave')
    return null
  }

  const [shipLat, shipLng] = vector3ToLatLng(
    new Vector3(ship.x, ship.y, ship.z)
  )
  const playerCell = latLngToCell(shipLat, shipLng, MARKER_RESOLUTION)

  console.log('[SPAWN-DEBUG] Player start marker', {
    x: ship.x,
    y: ship.y,
    z: ship.z,
    lat: shipLat,
    lng: shipLng,
    cellRes3: playerCell,
  })
  console.log(
    '[SPAWN-DEBUG] First wave rock spawn markers',
    spawnedRocks.map((rock) => {
      const [rockLat, rockLng] = vector3ToLatLng(
        new Vector3(rock.x, rock.y, rock.z)
      )
      return {
        rockId: rock.id,
        x: rock.x,
        y: rock.y,
        z: rock.z,
        lat: rockLat,
        lng: rockLng,
        cellRes3: latLngToCell(rockLat, rockLng, MARKER_RESOLUTION),
        direction: {
          x: rock.angularVelocity.x,
          y: rock.angularVelocity.y,
          z: rock.angularVelocity.z,
          speed: rock.angularVelocity.length(),
        },
      }
    })
  )

  const globe = scene.getMeshByName('globe')
  if (!(globe instanceof TransformNode)) {
    console.warn('[SPAWN-DEBUG] Globe node not found')
    return null
  }

  disposables.add(createMarker(globe, playerCell, 'spawnDebugPlayer'))

  // Marker for every rock in the first spawned wave.
  spawnedRocks.forEach((rock, index) => {
    const [rockLat, rockLng] = vector3ToLatLng(
      new Vector3(rock.x, rock.y, rock.z)
    )
    const rockCell = latLngToCell(rockLat, rockLng, MARKER_RESOLUTION)
    disposables.add(createMarker(globe, rockCell, `spawnDebugRock_${index}`))
  })

  // Draw spawn border as many visible marker cells (easier to see than thin lines).
  const borderCells = new Set<string>()
  for (let i = 0; i < BORDER_SAMPLE_POINTS; i++) {
    const t = i / BORDER_SAMPLE_POINTS
    const p = sampleSpawnBorderPoint({ x: ship.x, y: ship.y, z: ship.z }, t)
    const [lat, lng] = vector3ToLatLng(new Vector3(p.x, p.y, p.z))
    borderCells.add(latLngToCell(lat, lng, MARKER_RESOLUTION))
  }
  let borderIndex = 0
  borderCells.forEach((h) => {
    disposables.add(createMarker(globe, h, `spawnDebugBorder_${borderIndex++}`))
  })

  onCleanup(() => {
    disposables.forEach((node) => {
      node.dispose(false, true)
    })
  })

  return null
}
