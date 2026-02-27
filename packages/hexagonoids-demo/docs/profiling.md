# Profiling `@heygrady/hexagonoids-demo`

This package has lightweight profiling scripts modeled after the `neat-js` demo workflow.
The profile capture uses Node inspector around the `train()` call, so results are focused on training work rather than process startup.
By default, it also records worker-stage simulation profiling to a sibling `*.sim.jsonl` file.

## Generate a CPU Profile

From repo root:

```bash
yarn workspace @heygrady/hexagonoids-demo profile
```

Defaults (focused train run, not Vitest):
- method: `HyperNEAT`
- population: `32`
- iterations: `1`
- maxTicks: `400`
- threadCount: `1`
- output dir: `packages/hexagonoids-demo/.artifacts/profiles`
- output file: timestamped `*.cpuprofile`
- worker stage output: matching `*.sim.jsonl`

Optional args:

```bash
yarn workspace @heygrady/hexagonoids-demo profile -- \
  --output-dir .artifacts/profiles \
  --name latest.cpuprofile \
  --method NEAT \
  --populationSize 64 \
  --maxTicks 1000
```

## Analyze a Profile

```bash
yarn workspace @heygrady/hexagonoids-demo profile:analyze -- \
  .artifacts/profiles/latest.cpuprofile
```

This prints:
- total sampled time
- top functions by self time (with self/total percentages)
- worker simulation-stage breakdown (agent/step/reward/memory) when `*.sim.jsonl` exists

It also writes a machine-readable summary JSON next to the profile:
- `*.summary.json`

Optional args:
- `--top 50`: number of rows in the console table
- `--summary <path>`: explicit summary output path
- `--include-runtime`: include `(idle)` and `(program)` rows in output
- `--sort total|self`: sort by inclusive (`total`, default) or self time
- `--repo-only`: include only first-party repo code (excludes `node_modules`)
- `--sim-profile <path>`: explicit worker-stage jsonl path
- `--no-worker-profile`: skip worker-stage section

## Flamegraph Viewing

Open the generated `*.cpuprofile` in:
- Chrome DevTools Performance tab
- Speedscope

Use repeated runs with the same profile args to track hot-path changes after optimization passes.
