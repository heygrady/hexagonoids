import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import { resetBoard } from '../board/BoardSetters.js'
import { type PlayerToken } from '../player/PlayerState.js'
import type { PlayerStore } from '../player/PlayerStore.js'

import type {
  EvolutionStatus,
  GameLoop,
  GameOutcome,
  GameStatus,
  GenerationSnapshot,
} from './GameState.js'
import type { GameStore } from './GameStore.js'

export interface GameSetters {
  resetGame: OmitFirstArg<typeof resetGame>
  addPlayer: OmitFirstArg<typeof addPlayer>
  removePlayer: OmitFirstArg<typeof removePlayer>
  setPlayerIndex: OmitFirstArg<typeof setPlayerIndex>

  // Generation entity setters
  setCommitted: OmitFirstArg<typeof setCommitted>
  setTraining: OmitFirstArg<typeof setTraining>
  setPending: OmitFirstArg<typeof setPending>
  setOpponent: OmitFirstArg<typeof setOpponent>
  setBest: OmitFirstArg<typeof setBest>

  // Glicko rating setters
  setLatestGlickoData: OmitFirstArg<typeof setLatestGlickoData>
  setPlayerGlickoData: OmitFirstArg<typeof setPlayerGlickoData>

  // Match statistics
  setWinCount: OmitFirstArg<typeof setWinCount>
  setDrawCount: OmitFirstArg<typeof setDrawCount>
  setLossCount: OmitFirstArg<typeof setLossCount>

  // Game state
  setStatus: OmitFirstArg<typeof setStatus>
  setEvolutionStatus: OmitFirstArg<typeof setEvolutionStatus>
  setGameOutcome: OmitFirstArg<typeof setGameOutcome>
  setLoop: OmitFirstArg<typeof setLoop>
  setAbortController: OmitFirstArg<typeof setAbortController>
  setMatchAbortController: OmitFirstArg<typeof setMatchAbortController>
  setEvolutionPromise: OmitFirstArg<typeof setEvolutionPromise>
  setMatchPromise: OmitFirstArg<typeof setMatchPromise>
  setSkipWaiting: OmitFirstArg<typeof setSkipWaiting>
  setIsWaitingForEvolution: OmitFirstArg<typeof setIsWaitingForEvolution>
  setAutoPlay: OmitFirstArg<typeof setAutoPlay>
  setHumanPlayerToken: OmitFirstArg<typeof setHumanPlayerToken>
  setOperationStatus: OmitFirstArg<typeof setOperationStatus>
}

export const bindGameSetters = ($game: GameStore): GameSetters => ({
  resetGame: action($game, 'resetGame', resetGame),
  addPlayer: action($game, 'addPlayer', addPlayer),
  removePlayer: action($game, 'removePlayer', removePlayer),
  setPlayerIndex: action($game, 'setPlayerIndex', setPlayerIndex),

  // Generation entity setters
  setCommitted: action($game, 'setCommitted', setCommitted),
  setTraining: action($game, 'setTraining', setTraining),
  setPending: action($game, 'setPending', setPending),
  setOpponent: action($game, 'setOpponent', setOpponent),
  setBest: action($game, 'setBest', setBest),

  // Glicko rating setters
  setLatestGlickoData: action(
    $game,
    'setLatestGlickoData',
    setLatestGlickoData
  ),
  setPlayerGlickoData: action(
    $game,
    'setPlayerGlickoData',
    setPlayerGlickoData
  ),

  // Match statistics
  setWinCount: action($game, 'setWinCount', setWinCount),
  setDrawCount: action($game, 'setDrawCount', setDrawCount),
  setLossCount: action($game, 'setLossCount', setLossCount),

  // Game state
  setStatus: action($game, 'setStatus', setStatus),
  setEvolutionStatus: action($game, 'setEvolutionStatus', setEvolutionStatus),
  setGameOutcome: action($game, 'setGameOutcome', setGameOutcome),
  setLoop: action($game, 'setLoop', setLoop),
  setAbortController: action($game, 'setAbortController', setAbortController),
  setMatchAbortController: action(
    $game,
    'setMatchAbortController',
    setMatchAbortController
  ),
  setEvolutionPromise: action(
    $game,
    'setEvolutionPromise',
    setEvolutionPromise
  ),
  setMatchPromise: action($game, 'setMatchPromise', setMatchPromise),
  setSkipWaiting: action($game, 'setSkipWaiting', setSkipWaiting),
  setIsWaitingForEvolution: action(
    $game,
    'setIsWaitingForEvolution',
    setIsWaitingForEvolution
  ),
  setAutoPlay: action($game, 'setAutoPlay', setAutoPlay),
  setHumanPlayerToken: action(
    $game,
    'setHumanPlayerToken',
    setHumanPlayerToken
  ),
  setOperationStatus: action($game, 'setOperationStatus', setOperationStatus),
})

export const resetGame = ($game: GameStore) => {
  const $board = $game.get().$board
  resetBoard($board)
  $game.setKey('players', [])
}

export const addPlayer = ($game: GameStore, $player: PlayerStore) => {
  const players = $game.get().players
  if (players.length >= 2) {
    throw new Error('Maximum number of players reached')
  }
  const token = $player.get().token
  for (const $p of players) {
    if (token === $p.get().token) {
      throw new Error(`Player with token ${token} already in use`)
    }
  }
  $game.setKey('players', [...players, $player])
}

export const removePlayer = ($game: GameStore, $player: PlayerStore) => {
  const players = $game.get().players.filter((p) => p !== $player)
  $game.setKey('players', players)
}

export const setPlayerIndex = ($game: GameStore, index: number) => {
  $game.setKey('playerIndex', index)
}

// Generation entity setters
export const setCommitted = (
  $game: GameStore,
  snapshot: GenerationSnapshot | undefined
) => {
  $game.setKey('committed', snapshot)
}

export const setTraining = (
  $game: GameStore,
  snapshot: GenerationSnapshot | undefined
) => {
  $game.setKey('training', snapshot)
}

export const setPending = (
  $game: GameStore,
  snapshot: GenerationSnapshot | undefined
) => {
  $game.setKey('pending', snapshot)
}

export const setOpponent = (
  $game: GameStore,
  snapshot: GenerationSnapshot | undefined
) => {
  $game.setKey('opponent', snapshot)
}

export const setBest = (
  $game: GameStore,
  snapshot: GenerationSnapshot | undefined
) => {
  $game.setKey('best', snapshot)
}

export const setLatestGlickoData = (
  $game: GameStore,
  data:
    | {
        rating: number
        rd: number
        vol: number
        fitness: number
      }
    | undefined
) => {
  $game.setKey('latestGlickoData', data)
}

export const setPlayerGlickoData = (
  $game: GameStore,
  data:
    | {
        rating: number
        rd: number
        vol: number
      }
    | undefined
) => {
  $game.setKey('playerGlickoData', data)
}

// Match statistics
export const setWinCount = ($game: GameStore, count: number) => {
  $game.setKey('winCount', count)
}

export const setDrawCount = ($game: GameStore, count: number) => {
  $game.setKey('drawCount', count)
}

export const setLossCount = ($game: GameStore, count: number) => {
  $game.setKey('lossCount', count)
}

// Game state
export const setStatus = ($game: GameStore, status: GameStatus) => {
  $game.setKey('status', status)
}

export const setEvolutionStatus = (
  $game: GameStore,
  status: EvolutionStatus
) => {
  $game.setKey('evolutionStatus', status)
}

export const setEvolutionPromise = (
  $game: GameStore,
  promise: Promise<any> | undefined
) => {
  $game.setKey('evolutionPromise', promise)
}

export const setMatchPromise = (
  $game: GameStore,
  promise: Promise<void> | undefined
) => {
  $game.setKey('matchPromise', promise)
}

export const setGameOutcome = (
  $game: GameStore,
  outcome: GameOutcome | undefined
) => {
  $game.setKey('gameOutcome', outcome)
}

export const setLoop = ($game: GameStore, loop: GameLoop) => {
  $game.setKey('loop', loop)
}

export const setAbortController = (
  $game: GameStore,
  controller: AbortController | undefined
) => {
  $game.setKey('abortController', controller)
}

export const setMatchAbortController = (
  $game: GameStore,
  controller: AbortController | undefined
) => {
  $game.setKey('matchAbortController', controller)
}

export const setSkipWaiting = (
  $game: GameStore,
  skip: (() => void) | undefined
) => {
  $game.setKey('skipWaiting', skip)
}

export const setIsWaitingForEvolution = (
  $game: GameStore,
  isWaiting: boolean
) => {
  $game.setKey('isWaitingForEvolution', isWaiting)
}

export const setAutoPlay = ($game: GameStore, autoPlay: boolean) => {
  $game.setKey('autoPlay', autoPlay)
}

export const setHumanPlayerToken = ($game: GameStore, token: PlayerToken) => {
  $game.setKey('humanPlayerToken', token)
}

export const setOperationStatus = (
  $game: GameStore,
  status: 'resetting' | 'switching' | undefined
) => {
  $game.setKey('operationStatus', status)
}
