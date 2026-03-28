# Training Profiles

Profiles are now the canonical experiment definition for Hexagonoids.

Use them in:

- `train`
- `baseline`
- `inspect rewards`
- `inspect screen`
- `inspect validate`
- browser observe via `?profile=<name>`

## Normal profile shapes

Config-only tuning:

```ts
import { defineProfile } from './defineProfile.js'

export default defineProfile({
  name: 'turn-high-098',
  base: 'default',
  config: {
    behavioralGateConfig: {
      turn: { high: 0.98 },
    },
  },
})
```

Runtime-hook experiment:

```ts
import { defineProfile } from './defineProfile.js'

export default defineProfile({
  name: 'turn-discipline-rig',
  base: 'default',
  hooks: {
    reward: 'hexagonoids/turn-discipline-reward',
  },
})
```

## Built-in examples

- `default`
- `turn-high-098`
- `turn-discipline-rig`

## Runtime-only profile surface

Profiles use one experiment surface now:

- `base`
- `config`
- `hooks`
- `meta`

Lab uses the same profile resolution and runtime config surface as training.
