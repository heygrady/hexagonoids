import type { AbstractMesh, FreeCamera, Scene, Vector3 } from '@babylonjs/core'
import {
  cellToLatLng,
  getRes0Cells,
  gridDisk,
  gridDiskDistances,
  latLngToCell,
} from 'h3-js'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import {
  PLAYER_STARTING_LIVES,
  ROCK_WAVE_MIN_SCORES,
  ROCK_WAVE_SIZES,
  SHIP_REGENERATION_WAIT_PERIOD,
  SHIP_VALUE,
} from '../../constants'
import { vector3ToGeo } from '../../geoCoords/geoToVector3'
import { pickPoint } from '../../rock/pickPoint'
import { generateShip as _generateShip } from '../../ship/generateShip'
import type { CameraContextValue } from '../../ShipCamera'
import { generateRock } from '../rockPool/RockPoolActions'
import type { RockPoolStore } from '../rockPool/RockPoolStore'
import type { ShipState } from '../ship/ShipState'
import { getShipStore } from '../shipPool/ShipPool'
import { addShip } from '../shipPool/ShipPoolSetters'
import type { ShipPoolStore } from '../shipPool/ShipPoolStore'

import { decrementLives, incrementScore } from './PlayerSetters'
import type { PlayerStore } from './PlayerStore'

export interface PlayerActions {
  start: OmitFirstArg<typeof startPlayer>
  spawnWave: OmitFirstArg<typeof spawnWave>
  die: OmitFirstArg<typeof die>
  regenerate: OmitFirstArg<typeof regenerate>
  score: OmitFirstArg<typeof score>
}

export const bindPlayerActions = ($player: PlayerStore): PlayerActions => ({
  start: action($player, 'start', startPlayer),
  spawnWave: action($player, 'spawnWave', spawnWave),
  die: action($player, 'die', die),
  regenerate: action($player, 'regenerate', regenerate),
  score: action($player, 'score', score),
})

// FIXME: move to a better place
export const getScreenCenter = (
  scene: Scene,
  cameraContext: CameraContextValue
) => {
  // FIXME: get globe from camera context
  const globe = scene.getMeshByName('globe')

  if (globe == null) {
    throw new Error('globe is not defined in the scene')
  }

  // FIXME: get camera from camera context
  const camera = scene.getCameraByName('shipCamera') as FreeCamera | null

  if (camera == null) {
    throw new Error('shipCamera is not defined in the scene')
  }
  const engine = scene.getEngine()
  const pixelRatio = window?.devicePixelRatio ?? 1
  const screenWidth = engine.getRenderWidth() / pixelRatio - pixelRatio
  const screenHeight = engine.getRenderHeight() / pixelRatio - pixelRatio

  const predicate = (mesh: AbstractMesh) =>
    mesh === globe || mesh === cameraContext.equatorialPlane

  const screenCenter = pickPoint(
    screenWidth / 2,
    screenHeight / 2,
    scene,
    camera,
    predicate
  )
  if (screenCenter == null) {
    throw new Error('screenCenter is not defined')
  }
  return screenCenter
}

export type BuildShipOptions = Partial<ShipState>

export const buildShip = (
  $player: PlayerStore,
  $ships: ShipPoolStore,
  scene: Scene,
  options?: BuildShipOptions
) => {
  const playerState = $player.get()

  // 1. Get a clean ship from the pool
  const $ship = playerState.$ship ?? getShipStore()

  // 2. Setup ship state
  if (options != null) {
    for (const [key, value] of Object.entries(options)) {
      if (value != null) {
        $ship.setKey(key as keyof ShipState, value)
      }
    }
  }

  // 3. Initialize the ship in the scene
  _generateShip(scene, $ship)

  if (playerState.$ship == null) {
    $player.setKey('$ship', $ship)
    $ship.setKey('$player', $player)
  }

  // 4. Add the ship to the active ships
  addShip($ships, $ship)
}

export const startPlayer = (
  $player: PlayerStore,
  $ships: ShipPoolStore,
  scene: Scene
) => {
  // Become alive
  $player.setKey('alive', true)
  $player.setKey('lives', PLAYER_STARTING_LIVES)
  $player.setKey('score', 0)
  $player.setKey('waveSpawnedAt', null)

  // pick a random res 0 starting cell
  const res0Cells = getRes0Cells()
  const randomIndex = Math.floor(Math.random() * res0Cells.length)
  const h = res0Cells[randomIndex]
  const [lat, lng] = cellToLatLng(h)

  const options: BuildShipOptions = {
    lat,
    lng,
  }

  // Build a ship
  buildShip($player, $ships, scene, options)

  $player.setKey('startedAt', Date.now())
}

export interface SpawnWaveOptions {
  lat: number
  lng: number
}

export const spawnWave = (
  $player: PlayerStore,
  $rocks: RockPoolStore,
  scene: Scene,
  options?: SpawnWaveOptions
) => {
  // Get the ship
  const playerState = $player.get()

  $player.setKey('waveSpawnedAt', Date.now())

  const $ship = playerState.$ship

  // Spawn a wave of rocks near the ship
  if ($ship == null && (options?.lat == null || options?.lng == null)) {
    console.warn('Cannot spawn a wave of rocks without a ship or lat/lng')
    return
  }

  const { lat, lng } = $ship?.get() ?? options ?? { lat: 0, lng: 0 }
  const h = latLngToCell(lat, lng, 1)
  // FIXME: move grid disk spawn distance to constants
  const [, , , disk3, disk4] = gridDiskDistances(h, 4)
  const disk3Set = new Set(disk3)
  const ring = disk4.filter((h) => !disk3Set.has(h))

  const score = playerState.score
  let waveSize = 0
  for (const [i, minScore] of ROCK_WAVE_MIN_SCORES.entries()) {
    if (score >= minScore) {
      waveSize = ROCK_WAVE_SIZES[i]
    }
  }
  console.log(
    `spawning wave; ${waveSize} new rocks; ${
      Object.keys($rocks.get()).length
    } total rocks`
  )

  for (let i = 0; i < waveSize; i++) {
    // take a random cell from the ring
    const index = Math.floor(Math.random() * ring.length)
    const spawnH = ring[index]
    ring.splice(index, 1)

    const [spawnLat, spawnLng] = cellToLatLng(spawnH)

    generateRock($rocks, scene, {
      lat: spawnLat,
      lng: spawnLng,
      // random heading between -Math.PI and Math.PI
      heading: Math.random() * 2 * Math.PI - Math.PI,
    })
  }
}

export const dieTimeoutIds = new Set<NodeJS.Timeout>()

export const die = (
  $player: PlayerStore,
  $ships: ShipPoolStore,
  scene: Scene,
  cameraContext?: CameraContextValue
) => {
  const playerState = $player.get()
  const $ship = playerState.$ship

  // Become dead
  $player.setKey('alive', false)
  $player.setKey('diedAt', Date.now())

  let lat: number | null = null
  let lng: number | null = null

  // Lose the ship
  if ($ship != null) {
    ;({ lat, lng } = $ship.get())
    $player.setKey('$ship', null)
    $ship.setKey('$player', null)
  }

  const lives = playerState.lives
  console.log(`Die: ${lives} lives left`)

  if (lives > 0) {
    const callback = () => {
      regenerate(
        $player,
        $ships,
        scene,
        cameraContext,
        lat != null && lng != null ? latLngToCell(lat, lng, 1) : undefined
      )
      dieTimeoutIds.delete(timeoutId)
    }
    // Come back to life
    const timeoutId = setTimeout(callback, SHIP_REGENERATION_WAIT_PERIOD)
    dieTimeoutIds.add(timeoutId)
  }
}

export const regenerate = (
  $player: PlayerStore,
  $ships: ShipPoolStore,
  scene: Scene,
  cameraContext?: CameraContextValue,
  cell?: string
) => {
  const playerState = $player.get()
  const lives = playerState.lives

  if (lives <= 0) {
    throw new Error('Cannot regenerate a player with 0 lives')
  }

  // Become alive
  $player.setKey('alive', true)
  $player.setKey('regeneratedAt', Date.now())

  // Spend a spare life
  decrementLives($player)

  const options: BuildShipOptions = {}
  let screenCenter: Vector3 | null = null
  if (cameraContext != null) {
    screenCenter = getScreenCenter(scene, cameraContext)
  }

  if (screenCenter != null) {
    // pick the center of the screen
    const { lat, lng } = vector3ToGeo(screenCenter)
    options.lat = lat
    options.lng = lng
  } else if (cell != null) {
    // pick a cell from the death disk
    const disk = gridDisk(cell, 3)
    const randomIndex = Math.floor(Math.random() * disk.length)
    const h = disk[randomIndex]
    const [lat, lng] = cellToLatLng(h)
    options.lat = lat
    options.lng = lng
  } else {
    // pick a random res 0 starting cell
    const res0Cells = getRes0Cells()
    const randomIndex = Math.floor(Math.random() * res0Cells.length)
    const h = res0Cells[randomIndex]
    const [lat, lng] = cellToLatLng(h)
    options.lat = lat
    options.lng = lng
  }

  // Build a ship
  buildShip($player, $ships, scene, options)
}

export const score = ($player: PlayerStore, score: number) => {
  if (score < 0) {
    throw new Error('Cannot set score to a negative number')
  }

  if (score > SHIP_VALUE) {
    throw new Error('Cannot set score to a number greater than SHIP_VALUE')
  }

  if (score === 0) {
    throw new Error('Cannot set score to 0')
  }
  incrementScore($player, score)
}
