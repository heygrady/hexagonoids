import fs from 'node:fs/promises'

import type { HeroGenome } from '@heygrady/tournament-strategy'
import {
  createConfig,
  createGenome,
  createState,
  type NEATGenomeData,
} from '@neat-evolution/neat'

const heroesLogPath = new URL('../../../heroes-log.jsonl', import.meta.url)
  .pathname
const heroesLogSavedPath = new URL(
  '../../../heroes-log-saved.jsonl',
  import.meta.url
).pathname

export async function initializeHeroesLog() {
  await fs.writeFile(heroesLogPath, '', 'utf-8')
}

export async function saveHeroesLog() {
  await fs.copyFile(heroesLogPath, heroesLogSavedPath)
}

export function handleHeroesUpdated(heroes: Array<HeroGenome<any>>) {
  const [hero] = heroes
  if (hero == null) return
  fs.appendFile(heroesLogPath, `${JSON.stringify(hero)}\n`).catch((error) => {
    console.error('Error writing heroes log:', error)
  })
}

export async function loadInitialHeroes(): Promise<Array<HeroGenome<any>>> {
  const fileContent = await fs.readFile(heroesLogSavedPath, 'utf-8')
  const lines = fileContent.split('\n').filter((line) => line.trim() !== '')
  const heroes: Array<HeroGenome<any>> = lines.map((line) => {
    const data = JSON.parse(line) as [[number, number, NEATGenomeData], any]
    const [, , genomeData] = data[0]
    const { config, state, genomeOptions, factoryOptions } = genomeData
    const configProvider = createConfig(config)
    const stateProvider = createState(state)
    const genome = createGenome(
      configProvider,
      stateProvider,
      genomeOptions,
      {
        inputs: 18,
        outputs: 9,
      },
      factoryOptions
    )
    return [[data[0][1], data[0][1], genome], data[1]]
  })
  return heroes
}
