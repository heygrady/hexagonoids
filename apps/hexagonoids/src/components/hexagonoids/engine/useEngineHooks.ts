import type { EngineHooks } from '@heygrady/hexagonoids-engine'

/**
 * Returns engine hooks for sound effects and visual feedback.
 * Placeholder for now — wire up actual callbacks when sound/effect
 * systems are integrated.
 *
 * TODO(Session 02+): Wire onCollision, onPlayerDied, onScoreChanged,
 * onWaveSpawned to the audio/effects systems. Pass the returned hooks
 * to createReactiveEngine(options, hooks) in EngineProvider.tsx.
 */
export function useEngineHooks(): EngineHooks {
  return {
    // onCollision: (_a, _b, _type) => {},
    // onPlayerDied: (_playerId) => {},
    // onScoreChanged: (_playerId, _score, _delta) => {},
    // onWaveSpawned: (_wave) => {},
  }
}
