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

`loadGenome` should remain pure deserialization with minimal shape checks (root object + genome/config/state). Avoid algorithm-specific parsing in this layer so replay stays stable and safe across algorithm changes.

## Node-Only Entry Point

Keep Node-only exports (CLI, persistence, train utilities) in a dedicated `./node` entrypoint so the default package surface remains browser-safe while still supporting Node consumers.
