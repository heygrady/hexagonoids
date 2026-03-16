import { Dispatcher } from '@neat-evolution/worker-actions'
import { WorkerPool } from '@neat-evolution/worker-pool'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import { makeScenarioCandidate } from './candidates.js'
import type {
  InstantDeathFilterReport,
  ScenarioCandidate,
  ScenarioOptions,
  SourceGenome,
} from './types.js'
import {
  annotateBatch,
  collectCandidates,
  filterInstantDeath,
  init,
  type ScenarioRef,
  scoutAgent,
  terminate,
} from './workerScenarioActions.js'

export interface ScenarioWorkerPool {
  collectCandidatesParallel(
    sources: SourceGenome[],
    options: ScenarioOptions
  ): Promise<ScenarioCandidate[]>

  filterInstantDeathParallel(
    candidates: ScenarioCandidate[],
    options: ScenarioOptions
  ): Promise<InstantDeathFilterReport>

  scoutPanelParallel(
    sources: SourceGenome[],
    scoutCandidates: ScenarioCandidate[],
    evalTicks: number
  ): Promise<Map<string, number[]>>

  annotateCandidatesParallel(
    candidates: ScenarioCandidate[],
    panelSources: SourceGenome[],
    options: ScenarioOptions
  ): Promise<ScenarioCandidate[]>

  terminate(): Promise<void>
}

function chunkArray<T>(array: T[], chunkCount: number): T[][] {
  if (chunkCount <= 0) return [array]
  const chunks: T[][] = []
  const chunkSize = Math.ceil(array.length / chunkCount)
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/** Extract minimal scenario reference from a candidate — no source metadata */
function toScenarioRef(candidate: ScenarioCandidate): ScenarioRef {
  return { id: candidate.id, scenario: candidate.scenario }
}

export async function createScenarioWorkerPool(options?: {
  threadCount?: number
  verbose?: boolean
}): Promise<ScenarioWorkerPool> {
  const threadCount =
    options?.threadCount ?? Math.max(1, hardwareConcurrency - 2)

  const workerScriptUrl = new URL('./workerScenarioScript.js', import.meta.url)

  const pool = new WorkerPool({
    threadCount,
    taskCount: threadCount,
    workerScriptUrl,
    workerOptions: {
      name: 'ScenarioWorker',
      type: 'module',
    },
  })

  const dispatcher = new Dispatcher(pool)

  // Wait for workers to be ready, then initialize runtimes
  await pool.ready()
  await dispatcher.broadcast(init({}))

  console.log(`Scenario worker pool initialized: ${threadCount} threads`)

  return {
    async collectCandidatesParallel(
      sources: SourceGenome[],
      scenarioOptions: ScenarioOptions
    ): Promise<ScenarioCandidate[]> {
      const captureTypes: Array<'death' | 'kill'> =
        scenarioOptions.killRatio > 0 ? ['death', 'kill'] : ['death']
      const promises = sources.map((source, i) => {
        if ((i + 1) % 8 === 0 || i === 0) {
          console.log(
            `Dispatching candidate collection ${i + 1}/${sources.length}`
          )
        }
        return dispatcher
          .call(
            collectCandidates({
              source,
              countPerSource: scenarioOptions.countPerSource,
              seed: scenarioOptions.seed,
              rewind: scenarioOptions.rewind,
              maxGames: scenarioOptions.maxGames,
              captureTypes,
              killRatio: scenarioOptions.killRatio,
            })
          )
          .then((result) => ({ source, result }))
      })

      const settled = await Promise.all(promises)

      // Assemble candidates on main thread — source stays here, not serialized back
      const candidates: ScenarioCandidate[] = []
      for (const { source, result } of settled) {
        for (const [index, scenario] of result.scenarios.entries()) {
          candidates.push(
            makeScenarioCandidate(`${source.id}:s${index}`, source, scenario)
          )
        }
      }
      return candidates
    },

    async filterInstantDeathParallel(
      candidates: ScenarioCandidate[],
      scenarioOptions: ScenarioOptions
    ): Promise<InstantDeathFilterReport> {
      const instantDeathTicks = Math.max(
        scenarioOptions.rewind + 30,
        Math.ceil(scenarioOptions.rewind * 1.5)
      )

      // Kill candidates skip instant-death filter entirely
      const deathCandidates = candidates.filter(
        (c) => c.scenario.captureType !== 'kill'
      )
      const killCandidates = candidates.filter(
        (c) => c.scenario.captureType === 'kill'
      )

      // Build lookup for reassembly
      const candidateById = new Map(deathCandidates.map((c) => [c.id, c]))

      // Send only scenario refs — no source metadata
      const chunks = chunkArray(deathCandidates, threadCount)
      const promises = chunks.map((chunk) =>
        dispatcher.call(
          filterInstantDeath({
            scenarioRefs: chunk.map(toScenarioRef),
            seed: scenarioOptions.seed,
            instantDeathTicks,
            instantDeathTrials: scenarioOptions.instantDeathTrials,
          })
        )
      )

      const results = await Promise.all(promises)

      // Reassemble full candidates on main thread
      const kept: ScenarioCandidate[] = []
      const removed: InstantDeathFilterReport['removed'] = []

      for (const result of results) {
        for (const k of result.kept) {
          const candidate = candidateById.get(k.id)
          if (candidate != null) {
            kept.push({
              ...candidate,
              filters: {
                instantDeathTicks: k.instantDeathTicks,
                instantDeathTrials: k.instantDeathTrials,
                instantDeathAllDied: false,
              },
            })
          }
        }
        for (const r of result.removed) {
          const candidate = candidateById.get(r.id)
          removed.push({
            id: r.id,
            sourceId: candidate?.source.id ?? '',
            instantDeathTicks: r.instantDeathTicks,
            instantDeathTrials: r.instantDeathTrials,
          })
        }
      }

      // Kill candidates pass through directly
      kept.push(...killCandidates)

      return { kept, removed, instantDeathTicks }
    },

    async scoutPanelParallel(
      sources: SourceGenome[],
      scoutCandidates: ScenarioCandidate[],
      evalTicks: number
    ): Promise<Map<string, number[]>> {
      // Send only the scenario snapshots — not full candidates
      const scoutScenarios = scoutCandidates.map((c) => c.scenario)

      const promises = sources.map((source, i) => {
        if ((i + 1) % 8 === 0 || i === 0) {
          console.log(
            `Dispatching scout ${i + 1}/${sources.length} against ${scoutCandidates.length} scenarios`
          )
        }
        return dispatcher.call(
          scoutAgent({
            source,
            scoutScenarios,
            evalTicks,
          })
        )
      })

      const results = await Promise.all(promises)
      const signatures = new Map<string, number[]>()
      for (const result of results) {
        signatures.set(result.id, result.signature)
      }
      return signatures
    },

    async annotateCandidatesParallel(
      candidates: ScenarioCandidate[],
      panelSources: SourceGenome[],
      scenarioOptions: ScenarioOptions
    ): Promise<ScenarioCandidate[]> {
      // Build lookup for reassembly
      const candidateById = new Map(candidates.map((c) => [c.id, c]))

      // Send only scenario refs — no source or existing metadata
      const chunks = chunkArray(candidates, threadCount)
      const promises = chunks.map((chunk, i) => {
        console.log(
          `Dispatching annotation batch ${i + 1}/${chunks.length} (${chunk.length} candidates)`
        )
        return dispatcher.call(
          annotateBatch({
            scenarioRefs: chunk.map(toScenarioRef),
            panelSources,
            evalTicks: scenarioOptions.evalTicks,
            randomBaselineTrials: scenarioOptions.randomBaselineTrials,
            seed: scenarioOptions.seed,
          })
        )
      })

      const results = await Promise.all(promises)

      // Merge annotations back onto full candidates on main thread
      const annotated: ScenarioCandidate[] = []
      for (const result of results) {
        for (const ann of result.annotations) {
          const candidate = candidateById.get(ann.id)
          if (candidate != null) {
            annotated.push({
              ...candidate,
              annotations: ann.annotations,
            })
          }
        }
      }
      return annotated
    },

    async terminate(): Promise<void> {
      await dispatcher.broadcast(terminate(null))
      await pool.terminate()
    },
  }
}
