---
name: serialization-contracts
description: Durable guidance for serialized organism contracts and persistence boundaries in hexagonoids-demo.
tags: [work-session, fp-ddd, hexagonoids-demo]
---

# Serialization Contracts

## Prefer Explicit Discriminators

Persist serialized organisms with an explicit discriminator (ex: `__kind`) and a `version`. Avoid relying on heuristics like `factoryOptions` presence alone; these blur the boundary between live `Organism` instances and serialized payloads.

## Centralize Validation

Keep a single serialized-organism validator in `serialization/` and reuse it in both persistence (`loadGenome`) and runtime hydration (manager replay). This keeps load/replay contracts aligned and prevents drift when the serialized shape changes.
