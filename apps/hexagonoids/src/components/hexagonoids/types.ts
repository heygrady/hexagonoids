import type { PlayerInputState } from '@heygrady/hexagonoids-engine'

export type AppMode = 'play' | 'record' | 'playback' | 'spawn-debug'

export interface FrameRecord {
  /** Elapsed time since session start (ms) */
  t: number
  /** Delta time for this tick (ms) */
  dt: number
  /** Bitpacked input flags: bit 0=left, 1=right, 2=thrust, 3=fire */
  i: number
}

/** Pack PlayerInputState booleans into a single number (4 bits). */
export function packInputs(input: PlayerInputState): number {
  return (
    (input.left ? 1 : 0) |
    (input.right ? 2 : 0) |
    (input.thrust ? 4 : 0) |
    (input.fire ? 8 : 0)
  )
}

/** Unpack a bitpacked input number back to PlayerInputState. */
export function unpackInputs(flags: number): PlayerInputState {
  return {
    left: (flags & 1) !== 0,
    right: (flags & 2) !== 0,
    thrust: (flags & 4) !== 0,
    fire: (flags & 8) !== 0,
  }
}
