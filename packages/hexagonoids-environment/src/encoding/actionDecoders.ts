import type { PlayerInputState } from '@heygrady/hexagonoids-engine'
import {
  isAmbiguousTurnConflict,
  type TurnInputDiagnostics,
} from '../evaluation/turnInputs.js'

export type ActionDecoder = (outputs: ArrayLike<number>) => PlayerInputState

export interface DecodedAction {
  input: PlayerInputState
  diagnostics: TurnInputDiagnostics
}

function decodeLegacyExclusiveTurn(
  leftSignal: number,
  rightSignal: number,
  threshold = 0
): Pick<PlayerInputState, 'left' | 'right'> & TurnInputDiagnostics {
  const rawLeft = leftSignal > threshold
  const rawRight = rightSignal > threshold
  const turnConflict = rawLeft && rawRight
  const turnAmbiguous = turnConflict
    ? isAmbiguousTurnConflict(leftSignal, rightSignal)
    : false

  if (!turnConflict) {
    return {
      left: rawLeft,
      right: rawRight,
      turnConflict,
      turnAmbiguous,
    }
  }

  if (leftSignal > rightSignal) {
    return {
      left: true,
      right: false,
      turnConflict: true,
      turnAmbiguous,
    }
  }
  if (rightSignal > leftSignal) {
    return {
      left: false,
      right: true,
      turnConflict: true,
      turnAmbiguous,
    }
  }

  return {
    left: false,
    right: false,
    turnConflict: true,
    turnAmbiguous,
  }
}

function decodeGroupedCategorical(outputs: ArrayLike<number>): DecodedAction {
  const left = outputs[4] ?? 0
  const none = outputs[5] ?? 0
  const right = outputs[6] ?? 0

  if (left > none && left > right) {
    return {
      input: {
        thrust: (outputs[0] ?? 0) >= (outputs[1] ?? 0),
        fire: (outputs[2] ?? 0) >= (outputs[3] ?? 0),
        left: true,
        right: false,
      },
      diagnostics: {
        turnConflict: false,
        turnAmbiguous: false,
      },
    }
  }

  if (right > left && right > none) {
    return {
      input: {
        thrust: (outputs[0] ?? 0) >= (outputs[1] ?? 0),
        fire: (outputs[2] ?? 0) >= (outputs[3] ?? 0),
        left: false,
        right: true,
      },
      diagnostics: {
        turnConflict: false,
        turnAmbiguous: false,
      },
    }
  }

  return {
    input: {
      thrust: (outputs[0] ?? 0) >= (outputs[1] ?? 0),
      fire: (outputs[2] ?? 0) >= (outputs[3] ?? 0),
      left: false,
      right: false,
    },
    diagnostics: {
      turnConflict: false,
      turnAmbiguous: false,
    },
  }
}

function decodePaired(outputs: ArrayLike<number>): DecodedAction {
  const leftSignal = (outputs[4] ?? 0) - (outputs[5] ?? 0)
  const rightSignal = (outputs[6] ?? 0) - (outputs[7] ?? 0)
  const turn = decodeLegacyExclusiveTurn(leftSignal, rightSignal)

  return {
    input: {
      thrust: (outputs[0] ?? 0) >= (outputs[1] ?? 0),
      fire: (outputs[2] ?? 0) >= (outputs[3] ?? 0),
      left: turn.left,
      right: turn.right,
    },
    diagnostics: {
      turnConflict: turn.turnConflict,
      turnAmbiguous: turn.turnAmbiguous,
    },
  }
}

function decodeBinary(outputs: ArrayLike<number>): DecodedAction {
  const leftSignal = outputs[2] ?? 0
  const rightSignal = outputs[3] ?? 0
  const rawLeft = leftSignal > 0.5
  const rawRight = rightSignal > 0.5

  return {
    input: {
      thrust: (outputs[0] ?? 0) > 0.5,
      fire: (outputs[1] ?? 0) > 0.5,
      left: rawLeft,
      right: rawRight,
    },
    diagnostics: {
      turnConflict: rawLeft && rawRight,
      turnAmbiguous:
        rawLeft && rawRight
          ? isAmbiguousTurnConflict(leftSignal, rightSignal)
          : false,
    },
  }
}

/** Vanilla grouped categorical: thrust(2), fire(2), turn(3). */
export const groupedCategoricalDecoder: ActionDecoder = (outputs) =>
  decodeGroupedCategorical(outputs).input

/** Legacy Vanilla + AC: 4 binary actions × [2, Softmax]. */
export const pairedDecoder: ActionDecoder = (outputs) => decodePaired(outputs).input

/** Legacy QL / 4-output controllers: 4 thresholded binary actions. */
export const binaryDecoder: ActionDecoder = (outputs) => decodeBinary(outputs).input

export function decodeActionOutputs(outputs: ArrayLike<number>): DecodedAction {
  if (outputs.length === 7) return decodeGroupedCategorical(outputs)
  if (outputs.length >= 8) return decodePaired(outputs)
  return decodeBinary(outputs)
}

/** Select decoder by output length. */
export function selectDecoder(outputLength: number): ActionDecoder {
  if (outputLength === 7) return groupedCategoricalDecoder
  if (outputLength >= 8) return pairedDecoder
  return binaryDecoder
}
