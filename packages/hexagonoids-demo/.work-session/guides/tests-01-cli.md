---
name: cli-testing
description: Testing CLI and main entrypoints in hexagonoids-demo — testing through exported entry points, not unexported parsers.
tags: [hexagonoids-demo, work-session, testing]
---

# CLI Testing Guide

## Test Through Entry Points, Not Unexported Parsers

`cli.ts` and `main.ts` have internal parser functions (`parseReplayOptions`,
`parseTrainLikeOptions`) that are **not exported**. Do not attempt to import or
test them directly. Instead, test through the exported entry points:

```typescript
import { runCli } from '../src/cli'
import { runMainCli } from '../src/main'
```

Invalid-arg paths return exit code 1 without hitting heavy `replayGenome`/`train`
dependencies, making them safe and fast to call in unit tests:

```typescript
it('returns 1 for unknown subcommand', async () => {
  const result = await runCli(['unknown'])
  expect(result).toBe(1)
})
```

## Avoid Heavy Dependency Paths in Tests

The CLI resolves `replayGenome` and `train` only on valid, fully-parsed
arguments. Tests that exercise invalid or missing argument paths never reach
those branches — they are safe unit tests with no worker/filesystem setup needed.

Mock only what the test actually exercises. If a test hits the error path,
no mocks for the training pipeline are required.
