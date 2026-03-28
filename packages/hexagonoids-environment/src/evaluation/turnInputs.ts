import type { PlayerInputState } from '@heygrady/hexagonoids-engine'

export interface TurnInputDiagnostics {
  turnConflict: boolean
  turnAmbiguous: boolean
}

const TURN_AMBIGUITY_MARGIN = 0.1

export function isAmbiguousTurnConflict(
  leftSignal: number,
  rightSignal: number
): boolean {
  const total = Math.abs(leftSignal) + Math.abs(rightSignal)
  if (total <= 1e-9) return true
  const normalizedMargin = Math.abs(leftSignal - rightSignal) / total
  return normalizedMargin < TURN_AMBIGUITY_MARGIN
}

export function normalizeExclusiveTurnInput(
  input: PlayerInputState
): PlayerInputState {
  const turnConflict = input.left && input.right
  return {
    thrust: input.thrust,
    fire: input.fire,
    left: input.left && !turnConflict,
    right: input.right && !turnConflict,
  }
}

export function detectTurnConflict(input: PlayerInputState): boolean {
  return input.left && input.right
}
