---
name: evaluation-variance-tips
description: Tips for seed scheduling, evaluator wiring, and run-best tracking in hexagonoids-demo training.
tags: [work-session, fp-ddd, hexagonoids-demo]
---

# Evaluation and Variance Tips

## Deterministic Per-Generation Seed Packs

Hexagonoids has high per-seed variance, so within-generation comparisons must share the same deterministic seed set. Build per-generation seed packs and ensure every organism in that generation is evaluated against the identical seed list.

Aggregate multi-seed fitness per organism before selection. This keeps the selection step fair and avoids overweighting any single seed.

## Run-Best Tracking

Use the `handleNewBest` callback (or equivalent run-level hook) to track the true run-best organism. `population.best()` only reports the last generation and can miss earlier bests when early-stop triggers.


## Population Aggregate Metrics

Capture per-run aggregates (mean/median fitness from the final population) directly in `TrainingRunResult` instead of scraping logs later. Use evaluation/metrics helpers so `train()` stays focused on orchestration, and keep baseline scoring in the same helper layer to avoid mixing evaluation math with trainer control flow.

## Typed Factory Adapters at Worker Boundaries

Avoid double-casting reproducer factories when passing them to workers. Instead, create per-method typed factory adapters so the worker boundary stays compile-time safe and signature drift is caught early.
