import type {
  EvaluationContext,
  EvaluationStrategy,
} from '@neat-evolution/evaluation-strategy'
import type {
  AnyGenome,
  GenomeEntries,
  GenomeEntry,
  FitnessData,
} from '@neat-evolution/evaluator'
import { Glicko2, type Player as GlickoPlayer } from 'glicko2'

import { addFillers } from './entities/addFillers.js'
import { toId } from './entities/toId.js'
import { createGlickoMatches } from './glicko/createMatches.js'
import { scoreSeedTournaments } from './glicko/scoreSeedTournaments.js'
import type {
  GlickoNormalizationRanges,
  GlickoObservedRanges,
  GlickoSettings,
} from './glicko/types.js'
import {
  defaultGlickoStrategyOptions,
  type GlickoStrategyOptions,
} from './GlickoStrategyOptions.js'
import {
  createMangledHeroEntry,
  selectBestGenomeByRawRating,
  sampleHeroesUniformly,
} from './heroes/index.js'
import type { HeroGenome } from './heroes/types.js'
import { glickoFitnessCalculator } from './score/glickoFitnessCalculator.js'
import type {
  GlickoScoreComponents,
  GlickoFitnessWeights,
} from './score/types.js'

export class GlickoStrategy<G extends AnyGenome<G>>
  implements EvaluationStrategy<G>
{
  public readonly options: GlickoStrategyOptions<G>

  private readonly glicko: Glicko2
  private readonly glickoSettings: GlickoSettings
  private readonly fitnessWeights: GlickoFitnessWeights

  private readonly playerRatings: Map<number, GlickoPlayer>
  private readonly heroIds = new Set<number>()
  private readonly fillerIds = new Set<number>()
  private readonly genomeEntriesMap = new Map<number, GenomeEntry<G>>()

  // --- Generational Hero Management ---
  private readonly generationalHeroes = new Map<number, HeroGenome<G>>()
  private currentGeneration = 0

  // --- Multi-Component Fitness Tracking ---
  private readonly normalizationRanges: GlickoNormalizationRanges
  private readonly observedRanges: GlickoObservedRanges
  private readonly onObservedRangeUpdate?:
    | ((ranges: GlickoObservedRanges) => void)
    | undefined

  constructor(options: Partial<GlickoStrategyOptions<G>> = {}) {
    this.options = {
      ...defaultGlickoStrategyOptions,
      ...options,
    }

    // Provide rational defaults for Glicko
    this.glickoSettings = {
      tau: 0.5,
      rating: 1500,
      rd: 350,
      vol: 0.06,
      ...this.options.glickoSettings,
    }

    const fitnessWeights: GlickoFitnessWeights = {
      ...defaultGlickoStrategyOptions.fitnessWeights,
      ...this.options.fitnessWeights,
    } as unknown as GlickoFitnessWeights

    // Validate that fitness weights sum to 1.0
    const weightSum =
      (fitnessWeights.seedWeight ?? 0) +
      (fitnessWeights.envWeight ?? 0) +
      (fitnessWeights.glickoWeight ?? 0) +
      (fitnessWeights.conservativeWeight ?? 0)

    if (Math.abs(weightSum - 1.0) > 1e-6) {
      console.warn(
        `⚠️  GlickoStrategy fitness weights sum to ${weightSum.toFixed(
          6
        )}, not 1.0. ` +
          `This will cause final fitness values to exceed [0, 1]. ` +
          `Current weights: seedWeight=${fitnessWeights.seedWeight}, ` +
          `envWeight=${fitnessWeights.envWeight}, ` +
          `glickoWeight=${fitnessWeights.glickoWeight}, ` +
          `conservativeWeight=${fitnessWeights.conservativeWeight}`
      )
    }

    this.fitnessWeights = fitnessWeights

    this.glicko = new Glicko2(this.glickoSettings)
    this.playerRatings = new Map()

    // --- Initialize normalization ranges ---
    const normalizationRanges: GlickoNormalizationRanges = {
      ...defaultGlickoStrategyOptions.normalizationRanges,
      ...this.options.normalizationRanges,
    } as unknown as GlickoNormalizationRanges

    // Validate normalization ranges
    this.validateNormalizationRanges(normalizationRanges)
    this.normalizationRanges = normalizationRanges
    // Initialize observed ranges to be wide open
    this.observedRanges = {
      environmentFitness: { min: Infinity, max: -Infinity },
      seedFitness: { min: Infinity, max: -Infinity },
      glickoRating: { min: Infinity, max: -Infinity },
      conservativeRating: { min: Infinity, max: -Infinity },
      seedGlickoRating: { min: Infinity, max: -Infinity },
      seedConservativeRating: { min: Infinity, max: -Infinity },
    }
    this.onObservedRangeUpdate = this.options.onObservedRangeUpdate

    // --- Initialize generational heroes from options ---
    if (this.options.initialHeroes != null) {
      for (let i = 0; i < this.options.initialHeroes.length; i++) {
        const hero = this.options.initialHeroes[i]
        if (hero != null) {
          const [entry, glickoData] = hero
          // Store with negative generation numbers for initial heroes
          this.generationalHeroes.set(-(i + 1), [entry, glickoData])
        }
      }
    }
    // Start from generation 0 for actual evolution
    this.currentGeneration = 0
  }

  async *evaluate(
    context: EvaluationContext<G>,
    genomeEntries: GenomeEntries<G>
  ): AsyncIterable<FitnessData> {
    // --- 1. State Initialization ---
    this.playerRatings.clear()
    this.heroIds.clear()
    this.fillerIds.clear()
    this.genomeEntriesMap.clear()

    const entries = Array.from(genomeEntries)

    // --- 2. Initialize Glicko Players ---

    // Load Heroes (uniformly sampled from all generations)
    const populationSize = entries.length
    const maxActiveHeroes = Math.ceil(
      populationSize * (this.options.heroPoolRatio ?? 0.2)
    )
    const activeHeroes = sampleHeroesUniformly(
      this.generationalHeroes,
      maxActiveHeroes
    )

    for (const [entry, glickoData] of activeHeroes) {
      const entryId = toId(entry)
      this.heroIds.add(entryId)
      this.genomeEntriesMap.set(entryId, entry) // Add hero to map

      // Always create fresh player from stored rating data (immutable anchors)
      const heroPlayer = this.glicko.makePlayer(
        glickoData.rating,
        glickoData.rd,
        glickoData.vol
      )
      this.playerRatings.set(entryId, heroPlayer)
    }

    // Load Current Population (with default ratings for now)
    for (const entry of entries) {
      const entryId = toId(entry)
      this.genomeEntriesMap.set(entryId, entry) // Set genome in map

      // Start with default ratings - will be updated by seed tournaments if enabled
      this.playerRatings.set(
        entryId,
        this.glicko.makePlayer(
          this.glickoSettings.rating,
          this.glickoSettings.rd,
          this.glickoSettings.vol
        )
      )
    }

    // --- 3. Add Fillers ---
    let allTournamentEntries = Array.from(this.genomeEntriesMap.values())
    const matchPlayerSize = this.options.matchPlayerSize
    if (allTournamentEntries.length % matchPlayerSize !== 0) {
      allTournamentEntries = addFillers(
        allTournamentEntries,
        matchPlayerSize,
        this.fillerIds
      )
    }

    // Add new fillers to Glicko system
    for (const entry of allTournamentEntries) {
      const entryId = toId(entry)
      if (this.fillerIds.has(entryId) && !this.playerRatings.has(entryId)) {
        this.genomeEntriesMap.set(entryId, entry) // Add filler to map
        this.playerRatings.set(
          entryId,
          this.glicko.makePlayer(
            this.glickoSettings.rating,
            this.glickoSettings.rd,
            this.glickoSettings.vol
          )
        )
      }
    }

    // --- 4. Run Seed Tournaments (if enabled) ---
    const rounds =
      this.options.rounds ?? Math.ceil(Math.log2(allTournamentEntries.length))
    let normalizedSeedScores: Map<number, number> | undefined
    let rawSeedScores: Map<number, number> | undefined
    let seedAIPlayer: GlickoPlayer | undefined
    if (this.options.individualSeeding) {
      const numSeedTournaments = this.options.numSeedTournaments ?? 5
      const seedTournamentResult = await scoreSeedTournaments(
        context,
        allTournamentEntries,
        numSeedTournaments,
        this.glicko,
        this.playerRatings,
        {
          currentGeneration: this.currentGeneration,
          normalizationRanges: this.normalizationRanges,
        }
      )

      normalizedSeedScores = seedTournamentResult.normalizedScores
      rawSeedScores = seedTournamentResult.rawScores
      seedAIPlayer = seedTournamentResult.seedAIPlayer

      // Track seed AI player ratings in observed ranges
      const seedGlickoRating = seedAIPlayer.getRating()
      const seedRD = seedAIPlayer.getRd()
      const seedConservativeRating = seedGlickoRating - 2 * seedRD

      let seedRangesUpdated = false
      if (
        seedGlickoRating <
        (this.observedRanges.seedGlickoRating.min ?? Infinity)
      ) {
        this.observedRanges.seedGlickoRating.min = seedGlickoRating
        seedRangesUpdated = true
      }
      if (
        seedGlickoRating >
        (this.observedRanges.seedGlickoRating.max ?? -Infinity)
      ) {
        this.observedRanges.seedGlickoRating.max = seedGlickoRating
        seedRangesUpdated = true
      }
      if (
        seedConservativeRating <
        (this.observedRanges.seedConservativeRating.min ?? Infinity)
      ) {
        this.observedRanges.seedConservativeRating.min = seedConservativeRating
        seedRangesUpdated = true
      }
      if (
        seedConservativeRating >
        (this.observedRanges.seedConservativeRating.max ?? -Infinity)
      ) {
        this.observedRanges.seedConservativeRating.max = seedConservativeRating
        seedRangesUpdated = true
      }

      if (seedRangesUpdated && this.onObservedRangeUpdate != null) {
        this.onObservedRangeUpdate(this.observedRanges)
      }

      // Apply seed scores to population ratings (not heroes/fillers)
      for (const entry of entries) {
        const entryId = toId(entry)
        const normalizedSeed = normalizedSeedScores.get(entryId) ?? 0.5
        const seededRating =
          (this.options.glickoSeedBaseRating ?? 1200) +
          normalizedSeed * (this.options.glickoSeedRatingRange ?? 600)

        // Update player rating with seeded value
        this.playerRatings.set(
          entryId,
          this.glicko.makePlayer(
            seededRating,
            this.glickoSettings.rd,
            this.glickoSettings.vol
          )
        )
      }
    }

    // --- 5. Run Tournament Rounds ---
    const previousOpponents = new Map<number, Set<number>>(
      allTournamentEntries.map((entry) => [toId(entry), new Set()])
    )
    const environmentScores = new Map<number, [total: number, count: number]>(
      allTournamentEntries.map((e) => [toId(e), [0, 0]])
    )
    const glickoMatches: Array<[GlickoPlayer, GlickoPlayer, number]> = []

    for (let round = 0; round < rounds; round++) {
      const roundSeed =
        String(this.currentGeneration * 1000 + round) +
        String(Math.random()).slice(2, 6) // Add randomness to avoid collisions
      const matches = createGlickoMatches(
        allTournamentEntries,
        this.playerRatings,
        previousOpponents,
        this.options.matchPlayerSize
      )

      const promises: Array<Promise<FitnessData[]>> = []
      for (const matchEntries of matches) {
        promises.push(context.evaluateGenomeEntryBatch(matchEntries, roundSeed))
      }
      const matchResults = await Promise.all(promises)

      for (const result of matchResults) {
        // Update environmentScores (running total and count)
        // Skip fillers since they're not yielded in final results
        for (const fitnessData of result) {
          const entryId = toId(fitnessData)
          if (!this.fillerIds.has(entryId)) {
            const fitness = fitnessData[2]
            const [total, count] = environmentScores.get(entryId) ?? [0, 0]
            environmentScores.set(entryId, [total + fitness, count + 1])
          }
        }

        // Convert to Glicko match format (assumes 2 players)
        if (result.length === 2) {
          const [dataA, dataB] = result as [FitnessData, FitnessData]
          if (dataA == null || dataB == null) continue

          const entryIdA = toId(dataA)
          const entryIdB = toId(dataB)

          const playerA = this.playerRatings.get(entryIdA)
          const playerB = this.playerRatings.get(entryIdB)
          if (playerA == null || playerB == null) continue
          const totalScore = dataA[2] + dataB[2]
          const scoreA = totalScore === 0 ? 0.5 : dataA[2] / totalScore
          glickoMatches.push([playerA, playerB, scoreA])
        }
      }
    }

    this.glicko.updateRatings(glickoMatches)

    // --- 6. Add Best Genome as Hero for This Generation ---
    const bestEntry = selectBestGenomeByRawRating(
      entries,
      this.playerRatings,
      this.fillerIds
    )
    if (bestEntry != null) {
      const bestEntryId = toId(bestEntry as GenomeEntry<G>)
      const bestPlayer = this.playerRatings.get(bestEntryId)
      if (bestPlayer != null) {
        // Create mangled entry for hero (prevents ID collision)
        const mangledEntry = createMangledHeroEntry(
          bestEntry as GenomeEntry<G>,
          this.generationalHeroes.size,
          this.genomeEntriesMap,
          this.heroIds,
          this.fillerIds
        )

        // Store hero with current generation number
        this.generationalHeroes.set(this.currentGeneration, [
          mangledEntry,
          {
            rating: bestPlayer?.getRating() ?? 0,
            rd: bestPlayer?.getRd() ?? 0,
            vol: bestPlayer?.getVol() ?? 0,
          },
        ])

        // Call optional listener
        this.options.onHeroesUpdated?.([
          [
            mangledEntry,
            {
              rating: bestPlayer?.getRating() ?? 0,
              rd: bestPlayer?.getRd() ?? 0,
              vol: bestPlayer?.getVol() ?? 0,
            },
          ],
        ])
      }
    }

    // Increment generation counter
    this.currentGeneration++

    // --- 7. Yield Final Fitness ---
    yield* this.normalizeGlickoScores(
      entries, // Only yield real population
      environmentScores,
      normalizedSeedScores,
      rawSeedScores
    )
  }

  /**
   * Validates normalization ranges to ensure they are properly configured.
   * Warns if min >= max for any range, which would cause NaN or invalid normalization.
   * @param {GlickoNormalizationRanges} ranges - The normalization ranges to validate
   */
  private validateNormalizationRanges(ranges: GlickoNormalizationRanges): void {
    const checkRange = (
      name: string,
      range: { min: number | null; max: number | null }
    ) => {
      const min = range.min ?? 0
      const max = range.max ?? 1
      if (min >= max) {
        console.warn(
          `⚠️  GlickoStrategy normalizationRange '${name}' is invalid: ` +
            `min (${min}) >= max (${max}). ` +
            `This will cause division by zero or NaN in normalization.`
        )
      }
    }

    checkRange('environmentFitness', ranges.environmentFitness)
    checkRange('seedFitness', ranges.seedFitness)
    checkRange('glickoRating', ranges.glickoRating)
    checkRange('conservativeRating', ranges.conservativeRating)
  }

  /**
   * Normalizes a value to [0, 1] using the specified range.
   * Gracefully clamps values that exceed the range.
   * @param value - Raw value to normalize
   * @param range - Min/max range for normalization
   * @param entries
   * @param environmentScores
   * @param normalizedSeedScores
   * @param rawSeedScores
   * @param seedAIPlayer
   * @returns Normalized value in [0, 1]
   */
  // private normalizeToRange(value: number, range: NormalizationRange): number {
  //   const min = range.min ?? 0
  //   const max = range.max ?? 1
  //   return (value - min) / (max - min)
  // }

  /**
   * Normalizes Glicko-based fitness components and yields final FitnessData.
   *
   * This method operates at the END of the evaluation flow, after both seed tournaments
   * and head-to-head matches have been completed. It normalizes component scores and
   * combines them into a final fitness value.
   *
   * The three evaluation phases:
   * 1. SEED TOURNAMENTS (individual evaluation):
   * - Each genome plays against built-in AI (minimax, heuristic, simple, random)
   * - These scores are normalized via scoreSeedTournaments() to [0, 1]
   * - Result: seedScore (optional, only if individualSeeding=true)
   *
   * 2. HEAD-TO-HEAD MATCHES (tournament evaluation):
   * - Genomes battle each other in head-to-head matches
   * - Winner/loser determined by Glicko-2 rating outcomes
   * - Result: glickoRating (strength against other genomes)
   *
   * 3. FINAL NORMALIZATION & COMBINATION (this method):
   * - Normalize all components using normalizationRanges
   * - Calculate conservativeScore = glickoRating - 2*RD (uncertainty-adjusted)
   * - Combine via glickoFitnessCalculator(components, weights)
   * - Track observed ranges for each component
   *
   * Components are normalized using configured ranges in this.normalizationRanges:
   * - environmentScore: Normalized from [envMin, envMax]
   * - seedScore: Already normalized to [0, 1] by scoreSeedTournaments()
   * - glickoScore: Normalized from [glickoMin, glickoMax]
   * - conservativeScore: Normalized from [conservativeMin, conservativeMax]
   *
   * NOTE: Normalization can produce values > 1.0 if observed values exceed the configured
   * < 0.0, which should never happen if ranges are configured correctly.
   * @template G - The genome type
   * @param {Array<GenomeEntry<G>>} entries - Genome entries to score
   * @param {Map<number, [total: number, count: number]>} environmentScores - Map of total/count game scores from gauntlet evaluation
   * @param {Map<number, number> | undefined} normalizedSeedScores - Pre-normalized seed tournament scores (already [0,1])
   * @param {Map<number, number> | undefined} rawSeedScores - Raw seed scores for range tracking
   * @yields {FitnessData} FitnessData for each evaluated genome
   */
  private *normalizeGlickoScores(
    entries: Array<GenomeEntry<G>>,
    environmentScores: Map<number, [total: number, count: number]>,
    normalizedSeedScores: Map<number, number> | undefined,
    rawSeedScores: Map<number, number> | undefined
  ): Iterable<FitnessData> {
    const envScoreRange = Math.max(
      1e-6,
      (this.normalizationRanges.environmentFitness.max ?? 1) -
        (this.normalizationRanges.environmentFitness.min ?? 0)
    )
    let rangesUpdated = false
    let bestEntry: GenomeEntry<G> | undefined
    let bestFitness = -Infinity
    let bestRating = 0
    let bestRd = 0
    let bestVol = 0

    for (const entry of entries) {
      const [speciesIndex, organismIndex] = entry
      const entryId = toId(entry)

      const totals = environmentScores.get(entryId)
      if (totals == null || totals[1] === 0) {
        yield [speciesIndex, organismIndex, 0]
        continue
      }

      // 1. Normalize environment score
      const [totalScore, totalGames] = totals
      const avgEnvironmentScore = totalScore / totalGames
      const normalizedEnvScore =
        (avgEnvironmentScore -
          (this.normalizationRanges.environmentFitness.min ?? 0)) /
        envScoreRange

      // 2. Get Glicko data
      const glickoPlayer = this.playerRatings.get(entryId)
      const glickoRating =
        glickoPlayer?.getRating() ?? this.glickoSettings.rating
      const glickoRd = glickoPlayer?.getRd() ?? this.glickoSettings.rd

      // 3. Calculate component values
      const conservativeRating = glickoRating - 2 * glickoRd

      // --- Check for new normalization range boundaries ---
      // Track environment fitness (raw, not normalized)
      if (
        avgEnvironmentScore <
        (this.observedRanges.environmentFitness.min ?? Infinity)
      ) {
        this.observedRanges.environmentFitness.min = avgEnvironmentScore
        rangesUpdated = true
      }
      if (
        avgEnvironmentScore >
        (this.observedRanges.environmentFitness.max ?? -Infinity)
      ) {
        this.observedRanges.environmentFitness.max = avgEnvironmentScore
        rangesUpdated = true
      }

      // Track raw seed scores (if available) in separate seedFitness range
      if (rawSeedScores != null) {
        const rawSeedScore = rawSeedScores.get(entryId)
        if (rawSeedScore != null) {
          if (
            rawSeedScore < (this.observedRanges.seedFitness.min ?? Infinity)
          ) {
            this.observedRanges.seedFitness.min = rawSeedScore
            rangesUpdated = true
          }
          if (
            rawSeedScore > (this.observedRanges.seedFitness.max ?? -Infinity)
          ) {
            this.observedRanges.seedFitness.max = rawSeedScore
            rangesUpdated = true
          }
        }
      }

      if (glickoRating < (this.observedRanges.glickoRating.min ?? Infinity)) {
        this.observedRanges.glickoRating.min = glickoRating
        rangesUpdated = true
      }
      if (glickoRating > (this.observedRanges.glickoRating.max ?? -Infinity)) {
        this.observedRanges.glickoRating.max = glickoRating
        rangesUpdated = true
      }
      if (
        conservativeRating <
        (this.observedRanges.conservativeRating.min ?? Infinity)
      ) {
        this.observedRanges.conservativeRating.min = conservativeRating
        rangesUpdated = true
      }
      if (
        conservativeRating >
        (this.observedRanges.conservativeRating.max ?? -Infinity)
      ) {
        this.observedRanges.conservativeRating.max = conservativeRating
        rangesUpdated = true
      }

      // 4. Normalize all components
      const glickoMin = this.normalizationRanges.glickoRating.min ?? 800
      const glickoMax = this.normalizationRanges.glickoRating.max ?? 2100

      const conservativeMin =
        this.normalizationRanges.conservativeRating.min ?? 400
      const conservativeMax =
        this.normalizationRanges.conservativeRating.max ?? 2000

      const components: GlickoScoreComponents = {
        environmentScore: normalizedEnvScore,
        glickoScore: (glickoRating - glickoMin) / (glickoMax - glickoMin),
        conservativeScore:
          (conservativeRating - conservativeMin) /
          (conservativeMax - conservativeMin),
      }
      if (components.environmentScore > 1) {
        console.log(components)
        throw new Error('Glicko score normalization exceeded 1.0')
      }
      if (components.glickoScore > 1) {
        console.log(components)
        throw new Error('Glicko score normalization exceeded 1.0')
      }
      if (components.conservativeScore > 1) {
        console.log(components)
        throw new Error('Glicko score normalization exceeded 1.0')
      }
      // Add seed score if available
      if (normalizedSeedScores != null) {
        const normalizedSeed = normalizedSeedScores.get(entryId)
        if (normalizedSeed !== undefined) {
          components.seedScore = normalizedSeed
          if (components.seedScore > 1) {
            console.log(components)
            throw new Error('Seed score normalization exceeded 1.0')
          }
        }
      }

      // 5. Calculate final fitness
      const fitness = glickoFitnessCalculator(components, this.fitnessWeights)

      // Track best entry by final fitness
      if (fitness > bestFitness) {
        bestFitness = fitness
        bestEntry = entry
        bestRating = glickoRating
        bestRd = glickoRd
        bestVol = glickoPlayer?.getVol() ?? this.glickoSettings.vol
      }

      yield [speciesIndex, organismIndex, fitness]
    }

    // Call best executor callback if configured
    if (bestEntry != null && this.options.onBestExecutorUpdate != null) {
      this.options.onBestExecutorUpdate({
        entry: bestEntry,
        fitness: bestFitness,
        rating: bestRating,
        rd: bestRd,
        vol: bestVol,
      })
    }

    if (rangesUpdated) {
      this.onObservedRangeUpdate?.(this.observedRanges)
    }
  }
}
