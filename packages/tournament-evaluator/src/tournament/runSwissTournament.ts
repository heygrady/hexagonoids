import type { GameExecutor } from '@heygrady/game-environment'

import { createSwissTournamentGames } from './createSwissTournamentGames.js'
import { normalizeTournamentScores } from './normalizeTournamentScores.js'
import { processGameScores } from './processGameScores.js'
import type {
  EvaluateGameCallbackFn,
  PlayerScore,
  Player,
  FitnessEntry,
} from './types.js'

export const runSwissTournament = async (
  players: Player[],
  game: GameExecutor<any, any, any, any>,
  evaluateGame: EvaluateGameCallbackFn
): Promise<FitnessEntry[]> => {
  const scores: PlayerScore[][] = []
  const maxRounds = Math.ceil(Math.log2(players.length))
  let round = 0
  while (round < maxRounds) {
    const games = createSwissTournamentGames(
      players,
      game.playerSize,
      scores.length > 0 ? scores[round - 1] : undefined
    )
    const promises: Array<Promise<PlayerScore[]>> = []
    for (const players of games) {
      promises.push(evaluateGame(players))
    }
    const gameScores: PlayerScore[][] = await Promise.all(promises)
    scores.push(processGameScores(gameScores))
    round++
  }
  return normalizeTournamentScores(scores, game)
}
