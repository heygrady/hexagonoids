# @heygrady/hexagonoids-engine

Headless game engine for Hexagonoids. Pure TypeScript with dual CJS/ESM builds, testing, and linting configured. Includes an optional SolidJS reactive layer (`@heygrady/hexagonoids-engine/solid`).

## Installation

This package is hosted on [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry). You'll need to configure your package manager to use the GitHub Packages registry for the `@heygrady` scope.

### Yarn (v2+)

Add to your `.yarnrc.yml`:

```yaml
npmScopes:
  heygrady:
    npmAlwaysAuth: true
    npmRegistryServer: "https://npm.pkg.github.com"
```

Then install:

```bash
yarn add @heygrady/hexagonoids-engine
```

### npm

Create a `.npmrc` file in your project root:

```
@heygrady:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @heygrady/hexagonoids-engine
```

## Usage

This package supports both CJS and ESM formats. You will see `cjs`, `esm` and `types` builds in the `dist` folder to support Common JS, ECMAScript Modules and TypeScript respectively. In practice you should be able to import it however you prefer and it will just work.

### TypeScript and ESM (preferred)

Node ESM and TypeScript support the same modern syntax for imports.

```ts
import {
  createGame,
  accelerateShip,
  turnShip,
  moveShip,
  moveBullet,
  moveRock,
} from '@heygrady/hexagonoids-engine'

const { state, rng } = createGame()
```

### Key exports

| Category | Exports |
| --- | --- |
| Factory | `createGame(options?)` |
| Types | `GameState`, `ShipState`, `RockState`, `BulletState`, `PlayerState`, `PlayerInputState`, `PlayerInputs`, `EntityRef`, `EntityType`, `CollisionType`, `CollisionPair`, `GameMode`, `EngineOptions`, `EngineHooks` |
| Defaults | `defaultGameState`, `defaultShipState`, `defaultRockState`, `defaultBulletState`, `defaultPlayerState` |
| Game time | `advanceGameTime`, `elapsed` |
| Ship physics | `accelerateShip(ship, duration)`, `turnShip(ship, direction, duration)`, `moveShip(ship, delta)` |
| Bullet/Rock | `moveBullet(bullet, delta)`, `moveRock(rock, delta)` |
| Quaternion primitives | `integrateAngularVelocity`, `headingToAngularVelocity`, `applyAngularFriction`, `clampAngularVelocity`, `getPositionFromQuaternion` |
| Lat/lng utilities | `latLngToVector3`, `vector3ToLatLng`, `quaternionToLatLng`, `latLngToQuaternion` |
| ID generation | `generateId`, `resetIdCounter` |
| Bullet actions | `spawnBullet`, `destroyBullet`, `expireBullets` |
| Bullet setters | `setBulletLat`, `setBulletLng`, `setBulletLocation`, `setBulletAngularVelocity` |
| Player actions | `startPlayer`, `killPlayer`, `regeneratePlayer`, `scorePlayer`, `canRegenerate`, `checkWaveSpawn` |
| Player setters | `setLives`, `setScore`, `decrementLives`, `incrementScore` |
| Rock actions | `spawnRock`, `spawnWave`, `destroyRock`, `splitRock` |
| Rock setters | `setRockLat`, `setRockLng`, `setRockLocation`, `setRockSize`, `setRockAngularVelocity` |
| Ship actions | `spawnShip`, `destroyShip`, `fireBullet` |
| Ship setters | `setShipLat`, `setShipLng`, `setShipLocation`, `setShipYaw`, `setShipFiredAt`, `setShipAngularVelocity` |
| Collision | `detectCollisions(game)`, `handleCollisions(game, pairs)`, `greatCircleDistance(lat1, lng1, lat2, lng2)` |
| Step | `step(game, inputs, delta)` |
| Constants | `MAX_SPEED`, `FRICTION_COEFFICIENT`, `TURN_RATE`, `ACCELERATION_RATE`, `MAX_DURATION`, `ROCK_LARGE_SIZE`, `ROCK_MEDIUM_SIZE`, `ROCK_SMALL_SIZE`, and more |

### SolidJS reactive layer (`@heygrady/hexagonoids-engine/solid`)

Requires `solid-js` peer dependency. Import from the `/solid` subpath.

| Category | Exports |
| --- | --- |
| Reactive engine | `createReactiveEngine(options?, hooks?)`, `ReactiveEngine` |
| Entity pool hook | `useEntityPool(engine, entityId, store)` |
| Context | `GameStateContext`, `useGameState()` |
| Entity hooks | `useBullet`, `useRock`, `useShip` |
| Player hooks | `usePlayer`, `usePlayerLives`, `usePlayerScore` |
| Pool hooks | `useBulletIds`, `usePlayerIds`, `useRockIds`, `useShipIds` |
| Game hooks | `useGameOver`, `useGameTime`, `useWave` |

`ReactiveEngine` exposes `state` (SolidJS store), `tick(inputs, dt)`, `mutate(fn)`, and `Accessor<string[]>` signals `shipIds`, `rockIds`, `bulletIds`, `playerIds`. All hooks take `ReactiveEngine` as their first argument. No JSX Provider is exported — consuming apps use `<GameStateContext.Provider>` directly.

### CJS

Legacy Node supports Common JS require syntax for imports.

```js
const { createGame } = require("@heygrady/hexagonoids-engine");

const { state, rng } = createGame();
```

## Development

```sh
# build (in watch mode)
yarn dev

# build
yarn build

# lint
yarn lint

# fix linting errors
yarn format

# test
yarn test

# test (in coverage mode)
yarn coverage

# clean up generated files
yarn clean
```
