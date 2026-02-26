---
name: agent-conventions
description: Simulation rate constants, agent tick assumptions, and test helper conventions for hexagonoids-environment agents.
tags: [hexagonoids-environment, work-session, testing]
---

# Agent Conventions

## DT_MS — Intentional Fixed Simulation Rate

`DT_MS = 33` in `seekDestroyUtils` is intentional, not a bug. Agents are
evaluated at a fixed simulation rate matching the environment's default
`SimulationConfig.dtMs` (33ms, approximately the engine's `MAX_DELTA` of
~33.3ms). The engine itself has no default `dtMs` — it takes `dtMs` as a
parameter to `step()`. This constant is exported from `seekDestroyUtils` so
it is the single source of truth for environment-layer agent tick assumptions:

```typescript
// seekDestroyUtils.ts
export const DT_MS = 33  // matches environment SimulationConfig default
```

Import `DT_MS` from `seekDestroyUtils` in any agent or test that needs to
simulate at the canonical tick rate. Do not hardcode `33` elsewhere.

## DAMP Test Helpers — Duplicate Per Test File

`gauntletAgent.test.ts` and `seekDestroyAgent.test.ts` both use the same helper
pattern (`mockRock`, `placeShipAtOrigin`, `createTestContext`) but they are
**not** in a shared file — they are intentionally duplicated per the DAMP-over-DRY
convention.

A third test file (`seekDestroyUtils.test.ts`) also has a `mockRock` helper,
so the extraction threshold has been met. Consider extracting shared helpers
(`mockRock`, `placeShipAtOrigin`, `createTestContext`) into a shared
`test/agents/testHelpers.ts` module.

## Agent Test Structure

Each agent test file follows this structure:

1. Local helper functions (`mockRock`, `placeShipAtOrigin`, `createTestContext`)
2. `describe` blocks per agent function
3. Tests assert on returned `PlayerInputState` booleans, not internal state

Assertions are behavioral: does the agent fire when a rock is in range? Does it
turn toward a bearing? Avoid testing internal calculations — test the input
decisions the agent emits.
