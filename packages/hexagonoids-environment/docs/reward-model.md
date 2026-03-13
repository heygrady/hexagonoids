# Hexagonoids Reward Model

The Phase 4 RL refactor gives the real hexagonoids gauntlet the same standard
semantics as the contrived demo. Every episode (scenario, full game, curriculum
micro-scenario) emits shaped rewards alongside the long-horizon fitness score so
Actor-Critic and Q-learning agents can train on meaningful rollout segments.

## Per-step rewards

Each simulation tick produces a dense reward that correlates with the final
fitness components:

| Signal | Value | Purpose |
| --- | --- | --- |
| Survival bonus | `+0.005` while the ship is alive | Keeps the agent engaged during long empty stretches |
| Score delta | `Δ score × 0.001` | Rewards destroying rocks (same metric used in fitness) |
| Shot penalty | `-0.002 × shotsFired` for that tick | Encourages accuracy by taxing wasted bullets |
| Death penalty | `-1` per life lost | Strongly discourages reckless play |
| Wave bonus | `+0.05` when advancing to a new wave | Promotes gauntlet progress beyond individual kills |

Curriculum and scenario episodes subtract the scenario baseline score before
computing the delta so agents only see domain progress they actually produced.

## Transition metadata (`info`)

Episodes emit standard `TransitionInfo` data ahead of each reward so the RL
agents can drive event-triggered rollout capture:

- `isInteresting = true` when the agent destroys a rock, dies, or advances a
  wave. These events align with the live reward spikes and correspond to the
  "interesting minisode" triggers described in the Phase 4 plan.
- `situationClass` identifies the domain context so agents can deduplicate
  redundant rollout segments:
  - Scenarios: the necklace cluster ID used by stratified sampling.
  - Curriculum: the cone index (0–7) for the micro-scenario.
  - Full games: omitted (full games already cover every context).

## Episode lifecycle

`HexagonoidsEnvironment` now implements both `EpisodicEnvironment` and
`AgentEnvironment`. Each evaluation path uses the same gauntlet:

- Scenario evaluation samples the same bank/seed combinations for both vanilla
  executors and RL agents.
- Full games and curriculum segments run the same number of seeds as before.
- Every episode reports the final `weightedFitnessSum` via the standard
  `EpisodeResult` metadata, so RL plugins and telemetry hooks can report the
  same fitness humans read in the generation logs.

The reward model is intentionally modest—values stay in a small range so they
align with the rollout-segment reward threshold defaults (`abs(reward) > 0.1`).
Tuning the constants allows future parts to balance curriculum vs scenario bias
without changing the RL plugins.
