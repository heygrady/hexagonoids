# Target Topology

## Command map

| Current surface | Recommended oclif id | Notes |
| --- | --- | --- |
| `baseline` | `baseline` | top-level command |
| `train` | `train` | top-level command |
| `episodic` | `episodic` | top-level command |
| `replay` | `replay` | top-level command |
| `lab` | `lab` | top-level command |
| `scenarios` | `scenarios` | top-level command |
| `inspect inputs` | `inspect inputs` | `src/commands/inspect/inputs.ts` |
| `inspect fitness` | `inspect fitness` | `src/commands/inspect/fitness.ts` |

## Recommended package shape

```text
packages/hexagonoids-demo/
  bin/
    dev.js
    run.js
  src/
    browser/
      index.ts
    cli/
      index.ts
    commands/
      baseline.ts
      train.ts
      episodic.ts
      replay.ts
      lab.ts
      scenarios.ts
      inspect/
        inputs.ts
        fitness.ts
    command-base/
      base-command.ts
      train-like-command.ts
      shared-flags.ts
      profile-resolution.ts
      output.ts
    features/
      episodic/
      inspect/
      lab/
      persistence/
      profiles/
      registries/
      runtime/
      scenarios/
      training/
    hooks/
      init/
        runtime.ts
    node/
      index.ts
    index.ts
```

## Layering rule

Keep these boundaries strict:

- `src/commands/*` owns CLI metadata, parsing, and command-level UX
- `src/command-base/*` owns shared CLI abstractions
- `src/features/*` owns domain workflows and domain-facing primitives
- `src/cli/index.ts` owns programmatic CLI entrypoints and core CLI rigging
- `src/browser/index.ts` owns the explicit browser-friendly package entry
- `src/node/index.ts` owns node-only exports that depend on `node:*`

Commands should be thin. They should parse input, call a service, and format output.

## Base command design

Recommended command base stack:

- `BaseCommand`
- `TrainLikeCommand extends BaseCommand`

`BaseCommand` should own:

- repo/package-aware helpers
- shared logging helpers using `this.log`, `this.warn`, `this.error`
- common parsers or coercion helpers that are not naturally expressible as flag parsers
- optional access to config/data/cache directories via `this.config`

`TrainLikeCommand` should own:

- shared train and baseline flags
- profile loading and merge order
- algorithm validation
- gate and scenario flag assembly
- RL flag assembly

## Shared flag group design

Build shared flag objects instead of repeating static definitions:

- `algorithmFlags`
- `simulationFlags`
- `scenarioFlags`
- `fitnessFlags`
- `gateFlags`
- `rlFlags`
- `profileFlags`
- `runtimeFlags`

Each command should compose only the groups it needs.

## Help model

Use native oclif help metadata first:

- `static summary`
- `static description`
- `static examples`
- `static aliases` only where compatibility matters

Do not add a custom help class in phase 1 unless you hit a concrete limitation. oclif's default help is already better than the current manual usage strings.

## Topic strategy

Use topics only where users actually think in namespaces.

Recommended now:

- `inspect`

Potential future topics if the toolset grows:

- `profiles`
- `analysis`
- `genomes`
- `scenarios`

Do not over-nest. oclif documentation explicitly discourages going too deep.

## Bin strategy

Primary bin:

- `hexagonoids-demo -> bin/run.js`

Development bin:

- `bin/dev.js` for local execution against source

## Plugin strategy

Use no first-party oclif plugin boundary at initial migration time.

After the cutover, consider plugins only for genuinely separable domains such as:

- internal experiment packs
- optional heavy analysis commands
- organization-specific commands that should not live in the core package
