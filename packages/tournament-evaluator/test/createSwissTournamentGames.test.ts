import type { GenomeEntry } from '@neat-evolution/evaluator'
import { describe, test, expect, beforeEach } from 'vitest'

import { createSwissTournamentGames } from '../src/tournament/createSwissTournamentGames.js'
import type { PlayerScore } from '../src/tournament/types.js'

let organismIndex = 0
const createTestPlayer = (): GenomeEntry<any> => {
  const entry: GenomeEntry<any> = [0, organismIndex, {}]
  organismIndex++
  return entry
}

describe('createSwissTournamentGames', () => {
  beforeEach(() => {
    organismIndex = 0
  })
  test('should create correct pairings for a 4 player Swiss tournament', () => {
    const players = [
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
    ]
    const games = createSwissTournamentGames(players, 2)

    // shoudl create 2 games
    expect(games.length).toBe(2)

    // no games should include duplicate players
    const playersInGames = new Set<GenomeEntry<any>>()
    for (const game of games) {
      for (const player of game) {
        expect(playersInGames.has(player)).toBe(false)
        playersInGames.add(player)
      }
    }
  })

  test('should create correct pairings for a 5 player Swiss tournament', () => {
    const players = [
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
    ]
    const games = createSwissTournamentGames(players, 2)

    // should create 3 games
    expect(games.length).toBe(3)

    // games should include one duplicate player
    const playersInGames = new Set<GenomeEntry<any>>()
    const duplicatePlayers = new Set<GenomeEntry<any>>()
    for (const game of games) {
      const playersInGame = new Set<GenomeEntry<any>>()
      for (const player of game) {
        if (playersInGames.has(player)) {
          duplicatePlayers.add(player)
        } else {
          playersInGames.add(player)
        }
        // no individual game shold have duplicate players
        expect(playersInGame.has(player)).toBe(false)
        playersInGame.add(player)
      }
    }
    expect(duplicatePlayers.size).toBe(1)
  })

  test('should throw when players is smaller than playerSize', () => {
    const players: Array<GenomeEntry<any>> = []
    expect(() => createSwissTournamentGames(players, 2)).toThrow()
  })

  test('should create pairing by score for a 5 player Swiss tournament', () => {
    const players = [
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
      createTestPlayer(),
    ]
    const scores: PlayerScore[] = [
      [0, 0, 1],
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 4],
      [0, 4, 5],
    ]
    const games = createSwissTournamentGames([...players], 2, scores)

    // should create 3 games
    expect(games.length).toBe(3)

    const game1 = games[0] as Array<GenomeEntry<any>>
    const game2 = games[1] as Array<GenomeEntry<any>>
    const game3 = games[2] as Array<GenomeEntry<any>>
    expect(game1[0]).toBe(players[4])
    expect(game1[1]).toBe(players[3])
    expect(game2[0]).toBe(players[2])
    expect(game2[1]).toBe(players[1])
    expect(game3[0]).toBe(players[0])
    expect(game3[1]).not.toBe(players[0])
  })
})
