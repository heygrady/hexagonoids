---
name: algorithm-registry-tips
description: Durable guidance for hexagonoids-demo algorithm registry defaults, stubs, and population creation.
tags: [work-session, fp-ddd, hexagonoids-demo]
---

# Algorithm Registry Tips

## Contract-Test Friendly Population Creation

The algorithm registry `createPopulation` should stay deterministic and side-effect free. Use lightweight evaluator/reproducer stubs so contract tests can instantiate populations without pulling in worker infrastructure.

Prefer typed factory stubs with `satisfies` over cast-based stubs. It keeps test wiring explicit and catches signature drift at compile time instead of runtime.

## Genome Option Defaults Need Deep Clones

DES-HyperNEAT mutates `genomeOptions.initConfig` during population creation. Always deep-clone default genome options before passing them into `createPopulation` to keep registry calls repeatable.

Use `structuredClone` for defaults instead of JSON serialization to avoid lossy cloning when option shapes evolve.
