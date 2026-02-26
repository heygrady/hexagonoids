---
name: evolution-manager-tips
description: Durable guidance for HexagonoidsEvolutionManager wiring, replay, and Node entrypoints in hexagonoids-demo.
tags: [work-session, fp-ddd, hexagonoids-demo]
---

# Evolution Manager Tips

## Keep Manager Orchestration Thin

Implement `HexagonoidsEvolutionManager` as a thin orchestrator that delegates training to `train()` and rehydrates the best organism from persisted JSON. This keeps worker lifecycle setup centralized in the existing training pipeline instead of duplicating worker wiring in the manager.

## Centralize Hydration in the Algorithm Registry

Route genome/phenotype hydration through the algorithm registry helpers. This keeps per-algorithm wiring in one source of truth and avoids divergent rehydration logic in manager or CLI paths.

## Favor Injection Over Direct FS Access

Keep `HexagonoidsEvolutionManager` decoupled from filesystem and training internals by injecting `trainer` and `deserializeOrganism`. This makes the manager testable and avoids hard dependencies on disk layout.

If the trainer already has the run-best organism, expose it via `TrainingRunResult.bestOrganism` so callers don't have to reload from disk.

## Keep loadGenome Minimal

`loadGenome` should remain pure deserialization with shape checks via
`assertSerializedOrganism` — validates `__kind === 'SerializedOrganism'`,
`version === 1`, `genome` (record), `genome.config` (record), `genome.state`
(record), and `factoryOptions`. Avoid algorithm-specific parsing in this layer
so replay stays stable and safe across algorithm changes.


## Serialize/Replay Discriminator

Replay can silently collapse if live `Organism` instances are misclassified as serialized payloads and rehydrated without factory wiring. Treat rehydration as a strict boundary: only rehydrate when the payload explicitly matches the serialized-organism contract (ex: `__kind` + `version`, or a serialized `genome.factoryOptions`). If it is already a live `Organism`, pass it through unchanged.

Centralize serialized-organism validation in a shared helper and use it in both persistence load and manager hydration so replay behavior matches training evaluation.

## Node-Only Entry Point

Keep Node-only exports (CLI, persistence, train utilities) in a dedicated `./node` entrypoint so the default package surface remains browser-safe while still supporting Node consumers.
