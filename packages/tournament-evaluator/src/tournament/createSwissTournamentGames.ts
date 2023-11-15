import { shuffle, threadRNG } from '@neat-evolution/utils'

import type { Player, PlayerScore } from './types.js'

export const sortByScore = (
  players: Player[],
  previousRound?: PlayerScore[]
): Player[] => {
  const scores: Record<string, number> =
    previousRound?.reduce((acc: Record<string, number>, [genomeId, score]) => {
      acc[genomeId] = score
      return acc
    }, {}) ?? {}

  return players.sort((a, b) => {
    const aScore = scores[a[0]] ?? 0
    const bScore = scores[b[0]] ?? 0
    return bScore - aScore
  })
}

export const createSwissTournamentGames = (
  players: Player[],
  playerSize: number,
  previousRound?: PlayerScore[]
): Player[][] => {
  if (players.length < playerSize) {
    throw new Error('Insufficient genomes to create a game.')
  }

  let shuffledPlayers: Player[] | undefined
  const isShufflingNeeded =
    previousRound == null || players.length % playerSize !== 0

  // Shuffle for the first round or if there's a remainder
  if (isShufflingNeeded) {
    shuffledPlayers = shuffle([...players], threadRNG()) // Create a shuffled copy for fair distribution
  }

  const sortedPlayers =
    previousRound == null
      ? (shuffledPlayers as Player[])
      : sortByScore(players, previousRound)

  const matches: Player[][] = []
  let sortedIndex = 0

  while (sortedIndex < sortedPlayers.length) {
    const players: Player[] = []
    for (
      let j = 0;
      j < playerSize && sortedIndex + j < sortedPlayers.length;
      j++
    ) {
      players.push(sortedPlayers[sortedIndex + j] as Player)
    }
    matches.push(players)
    sortedIndex += playerSize
  }

  // Handle remaining genomes (if any)
  let shuffledIndex = 0
  const lastGame = matches[matches.length - 1] as Player[]
  if (lastGame.length < playerSize && shuffledPlayers != null) {
    while (lastGame.length < playerSize) {
      const genomeEntry = shuffledPlayers[shuffledIndex] as Player
      let isGenomeAlreadyInGame = false

      for (const g of lastGame) {
        if (g[0] === genomeEntry[0] && g[1] === genomeEntry[1]) {
          isGenomeAlreadyInGame = true
          break // Exit the loop early if we find a match
        }
      }

      if (!isGenomeAlreadyInGame) {
        lastGame.push(genomeEntry)
      }
      shuffledIndex++
    }
  }

  return matches
}
