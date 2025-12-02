# @heygrady/template-ts

New package.

```sh
yarn add @heygrady/template-ts
```

## Usage

This package supports both CJS and ESM formats. You will see `cjs`, `esm` and `types` builds in the `dist` folder to support Common JS, ECMAScript Modules and TypeScript respectively. In practice you should be able to import it however you prefer and it will just work.

### TypeScript and ESM (preferred)

Node ESM and TypeScript support the same modern syntax for imports.

```ts
import { message } from '@heygrady/template-ts'

console.log(message)
```

### CJS

Legacy Node supports Common JS require syntax for imports.

```js
const { message } = require('@heygrady/template-ts')  

console.log(message)
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
