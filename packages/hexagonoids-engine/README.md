# @heygrady/hexagonoids-engine

Headless game engine for Hexagonoids. Pure TypeScript with dual CJS/ESM builds, testing, and linting configured.

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
import { createGame } from '@heygrady/hexagonoids-engine'

const { state, rng } = createGame()
```

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
