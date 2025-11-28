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
import { shuffle, threadRNG } from '@neat-evolution/utils'

import { addFillers } from './entities/addFillers.js'
import { toId } from './entities/toId.js'
import { evaluateIndividually } from './evaluate/evaluateIndividually.js'
import { defaultFitnessCalculator } from './score/defaultFitnessCalculator.js'
import { convertToMatchScores } from './swiss/convertToMatchScores.js'
import type {
  SwissTournamentStrategyOptions,
  PlayerScore,
  ScoreComponents,
} from './types.js'

export class SwissTournamentStrategy<G extends AnyGenome<G>>
  implements EvaluationStrategy<G>
{
  public readonly options: SwissTournamentStrategyOptions<G>
  private readonly fillerIds = new Set<number>()

  constructor(options: SwissTournamentStrategyOptions<G> = {}) {
    this.options = {
      matchPlayerSize: 2,
      minScore: -0.25,
      maxScore: 3,
      individualSeeding: false,
      ...options,
    }
  }

  async *evaluate(
    context: EvaluationContext<G>,
    genomeEntries: GenomeEntries<G>
  ): AsyncIterable<FitnessData> {
    let entries = Array.from(genomeEntries)

    // Add filler genomes to complete incomplete batches
    const matchPlayerSize = this.options.matchPlayerSize ?? 2
    if (entries.length % matchPlayerSize !== 0) {
      entries = addFillers(entries, matchPlayerSize, this.fillerIds)
    }

    // Calculate number of rounds
    const rounds = this.options.rounds ?? Math.ceil(Math.log2(entries.length))

    // Track cumulative tournament scores (for bracket pairing)
    const tournamentScores = new Map<number, number>(
      entries.map((e) => [toId(e), 0])
    )

    // Track cumulative environment scores (for final fitness)
    const environmentScores = new Map<number, [total: number, count: number]>(
      entries.map((e) => [toId(e), [0, 0]])
    )

    // Optionally evaluate individually for seeding
    let seedScores: Map<number, number> | undefined
    if (this.options.individualSeeding === true) {
      const playerScores = await evaluateIndividually(context, entries)
      seedScores = new Map(playerScores)
    }

    // Track previous opponents to avoid rematches
    const previousOpponents = new Map<number, Set<number>>(
      entries.map((entry) => [toId(entry), new Set()])
    )

    // Run tournament rounds
    for (let round = 0; round < rounds; round++) {
      const matches = this.createMatches(
        entries,
        previousOpponents,
        round === 0 ? undefined : Array.from(tournamentScores.entries())
      )

      // Evaluate all matches in parallel
      const promises: Array<Promise<FitnessData[]>> = []
      for (const matchEntries of matches) {
        promises.push(context.evaluateGenomeEntryBatch(matchEntries))
      }

      const matchResults = await Promise.all(promises)

      // Process each match result
      for (const result of matchResults) {
        // Update environment scores (running total and count)
        for (const fitnessData of result) {
          const entryId = toId(fitnessData)
          const fitness = fitnessData[2]
          const [total, count] = environmentScores.get(entryId) ?? [0, 0]
          environmentScores.set(entryId, [total + fitness, count + 1])
        }

        // Convert to match points and update tournament scores
        const matchPoints = convertToMatchScores(
          result,
          this.options.winDelta ?? 0.5
        )
        for (const [entryId, points] of matchPoints) {
          const current = tournamentScores.get(entryId) ?? 0
          tournamentScores.set(entryId, current + points)
        }
      }
    }

    // Calculate Buchholz scores (strength of schedule)
    const buchholzScores = this.calculateBuchholzScores(
      tournamentScores,
      previousOpponents,
      entries
    )

    // Normalize and yield final fitness scores using weighted scoring
    yield* this.normalizeTournamentScores(
      entries,
      rounds,
      environmentScores,
      buchholzScores,
      seedScores,
      tournamentScores
    )
  }

  /**
   * Group entries by their cumulative tournament score.
   * Returns brackets in descending score order.
   * @param {Array} entries - Genome entries to group
   * @param {Array} cumulativeScores - Array of [organismIndex, tournamentScore] tuples
   * @returns {Map} Map of score to entries, sorted by score descending
   */
  private groupByScoreBrackets(
    entries: Array<GenomeEntry<G>>,
    cumulativeScores: Array<[number, number]>
  ): Map<number, Array<GenomeEntry<G>>> {
    // Build score lookup
    const scores = new Map<number, number>(cumulativeScores)

    // Group by score
    const brackets = new Map<number, Array<GenomeEntry<G>>>()
    for (const entry of entries) {
      const [, organismIndex] = entry
      const score = scores.get(organismIndex) ?? 0

      if (!brackets.has(score)) {
        brackets.set(score, [])
      }
      const bracket = brackets.get(score)
      if (bracket != null) {
        bracket.push(entry)
      }
    }

    // Sort brackets by score descending
    const sortedBrackets = new Map(
      Array.from(brackets.entries()).sort(([a], [b]) => b - a)
    )

    return sortedBrackets
  }

  /**
   * Calculate Buchholz scores (strength of schedule).
   * Buchholz score = sum of all opponents' tournament scores.
   * @param {Map} tournamentScores - Final tournament scores (keyed by composite ID)
   * @param {Map} previousOpponents - Map of genome ID to opponent IDs
   * @param {Array} entries - All genome entries
   * @returns {Map} Map of composite entry ID to Buchholz score
   */
  private calculateBuchholzScores(
    tournamentScores: Map<number, number>,
    previousOpponents: Map<number, Set<number>>,
    entries: Array<GenomeEntry<G>>
  ): Map<number, number> {
    const buchholzScores = new Map<number, number>()

    // Calculate Buchholz for each genome
    for (const entry of entries) {
      const entryId = toId(entry)

      // Skip fillers
      if (this.fillerIds.has(entryId)) {
        continue
      }

      const opponentIds = previousOpponents.get(entryId)
      if (opponentIds == null || opponentIds.size === 0) {
        // No opponents faced (shouldn't happen in normal tournament)
        buchholzScores.set(entryId, 0)
        continue
      }

      // Sum opponents' tournament scores (including filler opponents)
      // Fillers represent real matches with real outcomes
      let buchholz = 0
      for (const opponentId of opponentIds) {
        const opponentScore = tournamentScores.get(opponentId) ?? 0
        buchholz += opponentScore
      }

      buchholzScores.set(entryId, buchholz)
    }

    return buchholzScores
  }

  /**
   * Pair entries from a list, avoiding previous opponents when possible.
   * @param {Array} entries - Ordered list of entries to pair
   * @param {Set} remainingEntries - Set of unpaired entries
   * @param {Map} previousOpponents - Map tracking previous match-ups
   * @param {number} matchPlayerSize - Number of players per match
   * @returns {Array} Array of matches
   */
  private pairEntriesFromList(
    entries: Array<GenomeEntry<G>>,
    remainingEntries: Set<GenomeEntry<G>>,
    previousOpponents: Map<number, Set<number>>,
    matchPlayerSize: number
  ): Array<Array<GenomeEntry<G>>> {
    const matches: Array<Array<GenomeEntry<G>>> = []
    let currentIndex = 0

    while (remainingEntries.size > 0) {
      const group: Array<GenomeEntry<G>> = []

      // Find next remaining entry starting from currentIndex (O(n) instead of O(n²))
      while (currentIndex < entries.length) {
        const entry = entries[currentIndex]
        if (entry != null && remainingEntries.has(entry)) {
          break
        }
        currentIndex++
      }

      if (currentIndex >= entries.length) {
        break
      }

      const currentEntry = entries[currentIndex]
      if (currentEntry == null) {
        break
      }

      group.push(currentEntry)
      remainingEntries.delete(currentEntry)
      currentIndex++

      // Find opponents
      for (let i = 1; i < matchPlayerSize; i++) {
        let opponent: GenomeEntry<G> | undefined

        // Try to find an opponent we haven't faced before
        for (const entry of remainingEntries) {
          if (
            !(
              previousOpponents.get(toId(currentEntry))?.has(toId(entry)) ??
              false
            )
          ) {
            opponent = entry
            break
          }
        }

        // Fallback to random opponent if all have been faced
        if (opponent == null) {
          const remaining = Array.from(remainingEntries)
          if (remaining.length > 0) {
            opponent = remaining[threadRNG().genRange(0, remaining.length)]
          }
        }

        if (opponent == null) {
          // This should no longer happen if createMatches guarantees an even list
          throw new Error(
            `Failed to find opponent. ${remainingEntries.size} entries remained.`
          )
        }

        group.push(opponent)
        remainingEntries.delete(opponent)

        previousOpponents.get(toId(currentEntry))?.add(toId(opponent))
        previousOpponents.get(toId(opponent))?.add(toId(currentEntry))
      }

      matches.push(group)
    }

    return matches
  }

  private createMatches(
    entries: Array<GenomeEntry<G>>,
    previousOpponents: Map<number, Set<number>>,
    previousRound?: PlayerScore[]
  ): Array<Array<GenomeEntry<G>>> {
    const matchPlayerSize = this.options.matchPlayerSize ?? 2

    if (entries.length < matchPlayerSize) {
      throw new Error('Insufficient players to create a match.')
    }

    // First round: random shuffle (no scores yet)
    if (previousRound == null) {
      const shuffled = shuffle([...entries], threadRNG())
      const remainingEntries = new Set(shuffled)
      return this.pairEntriesFromList(
        shuffled,
        remainingEntries,
        previousOpponents,
        matchPlayerSize
      )
    }

    // Subsequent rounds: pair using score brackets with "pair-down"
    const brackets = this.groupByScoreBrackets(entries, previousRound)
    const matches: Array<Array<GenomeEntry<G>>> = []
    let remainderEntries: Array<GenomeEntry<G>> = []

    // Iterate from highest score bracket to lowest
    for (const [, currentBracketEntries] of brackets) {
      // Combine remainders from previous (higher) bracket with current bracket
      // This correctly pairs the "worst" of the higher bracket with the "best"
      // of the current bracket.
      const entriesToPair = [...remainderEntries, ...currentBracketEntries]

      // Find how many will be left over *from this combined group*
      const numRemainders = entriesToPair.length % matchPlayerSize

      // These are the players who *can* be paired in this batch
      const numToPair = entriesToPair.length - numRemainders
      const entriesForMatches = entriesToPair.slice(0, numToPair)

      // These are the players who will be passed to the *next* bracket
      remainderEntries = entriesToPair.slice(numToPair)

      // Don't try to pair if there's not enough for a single match
      if (entriesForMatches.length === 0) {
        continue
      }

      // Create the set of available players for this batch
      const bracketSet = new Set<GenomeEntry<G>>(entriesForMatches)

      // Pair them. This list is guaranteed to be a multiple of matchPlayerSize,
      // which prevents the "Failed to find opponent" error.
      const bracketMatches = this.pairEntriesFromList(
        entriesForMatches, // The ordered list to pick from
        bracketSet, // The set of available players
        previousOpponents,
        matchPlayerSize
      )

      matches.push(...bracketMatches)
    }

    // After all brackets, remainderEntries *must* be 0
    // because the initial `addFillers` call guaranteed the
    // total number of entries is a multiple of matchPlayerSize.
    if (remainderEntries.length > 0) {
      // This indicates a critical logic error (e.g., addFillers failed)
      // But we can still try to pair them to be robust.
      console.warn(
        `SwissTournamentStrategy: ${remainderEntries.length} players remained unpaired after all brackets. This should not happen if fillers were added correctly. Attempting to pair remaining.`
      )
      const finalSet = new Set<GenomeEntry<G>>(remainderEntries)
      const finalMatches = this.pairEntriesFromList(
        remainderEntries,
        finalSet,
        previousOpponents,
        matchPlayerSize
      )
      matches.push(...finalMatches)
    }

    return matches
  }

  private *normalizeTournamentScores(
    entries: Array<GenomeEntry<G>>,
    rounds: number,
    environmentScores: Map<number, [total: number, count: number]>,
    buchholzScores?: Map<number, number>,
    seedScores?: Map<number, number>,
    tournamentScores?: Map<number, number>
  ): Iterable<FitnessData> {
    const minScore = this.options.minScore ?? -0.25
    const maxScore = this.options.maxScore ?? 3
    const scoreRange = maxScore - minScore

    const maxTournamentScore = rounds
    const maxBuchholz = rounds * rounds // Upper bound approximation

    const fitnessCalculator =
      this.options.fitnessCalculator ?? defaultFitnessCalculator

    // Normalize and yield fitness data (excluding fillers)
    for (const entry of entries) {
      const [speciesIndex, organismIndex] = entry
      const entryId = toId(entry)

      // Skip filler genomes
      if (this.fillerIds.has(entryId)) {
        continue
      }

      const totals = environmentScores.get(entryId)

      if (totals == null) {
        // If genome didn't play any matches, assign minimum fitness
        yield [speciesIndex, organismIndex, 0]
        continue
      }

      // Normalize environment score
      const [totalScore, totalGames] = totals
      const avgEnvironmentScore = totalScore / totalGames
      const normalizedEnvScore = (avgEnvironmentScore - minScore) / scoreRange

      if (isNaN(normalizedEnvScore)) {
        throw new Error(`Invalid environment score for entry ${entryId}`)
      }

      // Normalize tournament score
      const tournamentScore = tournamentScores?.get(entryId) ?? 0
      const normalizedTournamentScore = tournamentScore / maxTournamentScore

      // Normalize Buchholz score
      const buchholzScore = buchholzScores?.get(entryId)
      const normalizedBuchholz =
        buchholzScore != null
          ? Math.min(buchholzScore / maxBuchholz, 1.0)
          : undefined

      // Get seed score (already normalized from evaluateIndividually)
      const seedScore = seedScores?.get(entryId)
      let normalizedSeedScore: number | undefined
      if (seedScore != null) {
        normalizedSeedScore = (seedScore - minScore) / scoreRange
      }

      // Combine via fitness calculator
      const components: ScoreComponents = {
        environmentScore: normalizedEnvScore,
        tournamentScore: normalizedTournamentScore,
      }

      // Only include optional components if they're defined
      if (normalizedSeedScore != null) {
        components.seedScore = normalizedSeedScore
      }
      if (normalizedBuchholz != null) {
        components.buchholzScore = normalizedBuchholz
      }
      // check if any components are greater than 1.0 or less than 0.0
      if (
        components.environmentScore > 1.0 ||
        components.tournamentScore > 1.0 ||
        (components.seedScore != null && components.seedScore > 1.0) ||
        (components.buchholzScore != null && components.buchholzScore > 1.0)
      ) {
        console.error(
          `SwissTournamentStrategy: Invalid fitness components for entry ${entryId}:`,
          components
        )
        throw new Error('Fitness components must be between 0.0 and 1.0')
      }
      const fitness = fitnessCalculator(components, entry)

      yield [speciesIndex, organismIndex, fitness]
    }
  }
}
