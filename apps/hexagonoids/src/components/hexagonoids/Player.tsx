import { vector3ToLatLng } from '@heygrady/h3-babylon'
import { gridDisk, latLngToCell } from 'h3-js'
import type { Component, JSX } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene, useSceneStore } from '../solid-babylon/hooks/useScene'

import {
  MAX_ROCKS,
  ROCK_ENCOUNTER_COOLDOWN,
  ROCK_WAVE_PERIOD,
} from './constants'
import { useGame } from './hooks/useGame'
import { useRockPool } from './hooks/useRockPool'
import {
  type SpawnWaveOptions,
  getScreenCenter,
  spawnWave,
} from './store/player/PlayerActions'
import type { PlayerStore } from './store/player/PlayerStore'

export interface PlayerProps {
  children?: JSX.Element
  id: string
  store: PlayerStore
}

export const Player: Component<PlayerProps> = (props) => {
  const [$scene] = useSceneStore()
  const [$game] = useGame()
  const [$rocks] = useRockPool()
  const scene = useScene()
  const $player = unwrap(props.store)

  let rockEncounteredAt: number | null = null

  onBeforeRender(() => {
    const { waveSpawnedAt, $ship } = $player.get()
    const { startedAt } = $game.get()
    const rocks = Object.values($rocks.get())

    const canSpawn =
      (startedAt == null || $ship != null) && rocks.length < MAX_ROCKS

    let options: SpawnWaveOptions | undefined

    if (
      canSpawn &&
      (waveSpawnedAt == null || Date.now() - waveSpawnedAt > ROCK_WAVE_PERIOD)
    ) {
      let h: string | null = null
      const cameraContext = $scene.get().cameraContext
      if ($ship !== null) {
        const { lat, lng } = $ship.get()
        h = latLngToCell(lat, lng, 1)
      } else if (cameraContext != null) {
        const center = getScreenCenter(scene, cameraContext)
        const [lat, lng] = vector3ToLatLng(center)
        h = latLngToCell(lat, lng, 1)
        options = { lat, lng }
      }

      if (h == null) {
        throw new Error('Could not find a valid cell')
      }

      // check for nearby rocks first
      const disk = new Set(gridDisk(h, 3))

      for (const $rock of rocks) {
        if ($rock == null) {
          continue
        }
        const { lat, lng } = $rock.get()

        const rockH = latLngToCell(lat, lng, 1)
        if (disk.has(rockH)) {
          rockEncounteredAt = Date.now()
        }
      }

      // if no rocks nearby, spawn a wave
      if (
        rockEncounteredAt === null ||
        Date.now() - rockEncounteredAt > ROCK_ENCOUNTER_COOLDOWN
      ) {
        spawnWave($player, $rocks, scene, options)
      }
    }
  })

  return <>{props.children}</>
}
