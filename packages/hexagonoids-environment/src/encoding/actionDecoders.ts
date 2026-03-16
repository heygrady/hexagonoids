import type { PlayerInputState } from '@heygrady/hexagonoids-engine'

export type ActionDecoder = (outputs: ArrayLike<number>) => PlayerInputState

/** Vanilla + AC: 2N paired outputs → compare pairs */
export const pairedDecoder: ActionDecoder = (outputs) => ({
  thrust: (outputs[0] ?? 0) >= (outputs[1] ?? 0),
  fire: (outputs[2] ?? 0) >= (outputs[3] ?? 0),
  left: (outputs[4] ?? 0) >= (outputs[5] ?? 0),
  right: (outputs[6] ?? 0) >= (outputs[7] ?? 0),
})

/** QL multi-discrete or legacy 4-output: N binary outputs */
export const binaryDecoder: ActionDecoder = (outputs) => ({
  thrust: (outputs[0] ?? 0) > 0.5,
  fire: (outputs[1] ?? 0) > 0.5,
  left: (outputs[2] ?? 0) > 0.5,
  right: (outputs[3] ?? 0) > 0.5,
})

/** Select decoder by output length */
export function selectDecoder(outputLength: number): ActionDecoder {
  return outputLength >= 8 ? pairedDecoder : binaryDecoder
}
