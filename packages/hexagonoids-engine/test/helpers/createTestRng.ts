import type { RNG } from '@neat-evolution/utils'

export function createTestRng(): RNG {
  let i = 0
  const values = [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35, 0.45, 0.55,
    0.65, 0.75, 0.85, 0.95, 0.05, 0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72,
    0.82, 0.92, 0.02, 0.11, 0.21, 0.31, 0.41, 0.51, 0.61, 0.71, 0.81,
  ]
  const next = () => values[i++ % values.length] ?? 0.5
  const rng: RNG = {
    gen: () => next(),
    genRange: (min: number, max: number) =>
      Math.floor(next() * (max - min)) + min,
    genBool: () => next() < 0.5,
    derive: () => rng,
    toSeed: () => '__rng:0',
  }
  return rng
}
