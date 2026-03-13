import type { PlayerState } from '../types.js'

export function setScore(player: PlayerState, score: number): boolean {
  if (!player.alive) return false
  if (score < 0) return false
  if (player.score === score) return false
  player.score = score
  return true
}

export function incrementScore(player: PlayerState, delta: number): boolean {
  if (delta === 0) return false
  return setScore(player, player.score + delta)
}

export function setLives(player: PlayerState, lives: number): boolean {
  if (lives < 0) return false
  if (player.lives === lives) return false
  player.lives = lives
  return true
}

export function decrementLives(
  player: PlayerState,
  amount: number = 1
): boolean {
  if (amount === 0) return false
  const newLives = player.lives - amount
  if (newLives < 0) return false
  return setLives(player, newLives)
}
