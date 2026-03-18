# Hexagonoids Reward Model

Hexagonoids uses the phase-11 step substrate: the environment drives the game
loop, computes per-tick rewards, and finalizes each transition through
`StepAgent.completeStep(...)`. Vanilla executors and step-learning agents still
share the same gauntlet and final fitness calculation.

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

The environment attaches an optional `info` object to step outcomes so step
agents can consume event-level hints without changing the base transition
contract:

- `isInteresting = true` when the agent destroys a rock, dies, or advances a
  wave. These events align with the live reward spikes and correspond to the
  "interesting minisode" triggers described in the Phase 4 plan.
- `situationClass` identifies the domain context so agents can deduplicate
  redundant rollout segments:
  - Scenarios: the necklace cluster ID used by stratified sampling.
  - Curriculum: the cone index (0–7) for the micro-scenario.
  - Full games: omitted (full games already cover every context).

## Episode lifecycle

Each evaluation path uses the same gauntlet:

- Scenario evaluation samples the same bank/seed combinations for both vanilla
  executors and RL agents.
- Full games and curriculum segments run the same number of seeds as before.
- Every episode reports the final `weightedFitnessSum` through the environment's
  normal fitness path, so generation logs and step-learning telemetry stay
  aligned.

The reward model is intentionally modest—values stay in a small range so they
remain numerically stable across short scenarios and full games. Tuning the
constants allows future parts to balance curriculum vs scenario bias without
changing the step agent interface.
