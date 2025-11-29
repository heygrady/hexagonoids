# @heygrady/hexagonoids-app

The main web application for the hexagonoids project, featuring a 3D Asteroids-style game rendered on a hexagonal sphere and an interactive Tic-Tac-Toe demo for training and playing against NEAT neural network agents.

Built with Astro, SolidJS, Babylon.js, and Tailwind CSS.

## Features

### Hexagonoids Game

A 3D Asteroids clone rendered on a spherical surface using H3 hexagonal grids:

- Navigate a ship across a hexagonal sphere
- Destroy asteroids while avoiding collisions
- Score tracking and game states
- Keyboard controls for movement and shooting

### Tic-Tac-Toe NEAT Demo

An interactive demonstration of NEAT neural network training:

- Watch agents evolve in real-time in the browser
- Play against trained AI opponents
- Configure training parameters and algorithms
- Support for NEAT, CPPN, HyperNEAT, ES-HyperNEAT, and DES-HyperNEAT

## Technology Stack

- **[Astro](https://astro.build/)**: Static site generation with islands architecture
- **[SolidJS](https://www.solidjs.com/)**: Reactive UI components
- **[Babylon.js](https://www.babylonjs.com/)**: 3D rendering engine
- **[H3](https://h3geo.org/)**: Hexagonal hierarchical geospatial indexing
- **[Tailwind CSS](https://tailwindcss.com/)** + **[DaisyUI](https://daisyui.com/)**: Styling
- **[Nanostores](https://github.com/nanostores/nanostores)**: State management

## Pages

| Route | Description |
|-------|-------------|
| `/` | Hexagonoids 3D game |
| `/experiments/tictactoe` | Tic-Tac-Toe NEAT training demo |

## Development

### Prerequisites

From the monorepo root:

```bash
# Install all dependencies
yarn install

# Build all required packages
yarn build
```

### Commands

```bash
# Start development server (from monorepo root)
yarn dev

# Or start with workspace dependencies in watch mode
yarn workspace @heygrady/hexagonoids-app dev:workspace

# Build for production
yarn workspace @heygrady/hexagonoids-app build

# Preview production build
yarn workspace @heygrady/hexagonoids-app preview

# Type check
yarn workspace @heygrady/hexagonoids-app check

# Lint
yarn workspace @heygrady/hexagonoids-app lint

# Format
yarn workspace @heygrady/hexagonoids-app format
```

## Project Structure

```
src/
├── components/
│   ├── hexagonoids/       # 3D game components
│   │   ├── store/         # Game state (nanostores)
│   │   ├── bullet/        # Projectile system
│   │   ├── cell/          # Hexagonal cell rendering
│   │   ├── colission/     # Collision detection
│   │   └── *.tsx          # SolidJS/Babylon components
│   ├── tictactoe/         # NEAT demo components
│   │   ├── stores/        # Game and training state
│   │   ├── modules/       # Worker thread modules
│   │   ├── hooks/         # SolidJS hooks
│   │   └── *.tsx          # UI components
│   └── solid-babylon/     # Babylon.js SolidJS integration
├── layouts/
│   └── Layout.astro       # Base page layout
└── pages/
    ├── index.astro        # Hexagonoids game
    └── experiments/
        └── tictactoe.astro # NEAT training demo
```

## Key Dependencies

### Internal Packages

- **@heygrady/h3-babylon**: H3 to Babylon.js coordinate conversion
- **@heygrady/tictactoe-game**: Game logic and AI players
- **@heygrady/tictactoe-environment**: NEAT environment adapter
- **@heygrady/tictactoe-demo**: Training utilities

### External

- **@neat-evolution/\***: NEAT algorithm implementations
- **h3-js**: Hexagonal geospatial indexing
- **@babylonjs/core**: 3D rendering
- **solid-js**: Reactive UI framework

## Configuration

### Astro Config

The app uses Astro with:

- SolidJS integration for reactive components
- Tailwind CSS for styling
- Vercel adapter for deployment

### Vite Config

Custom Vite configuration for:

- Worker thread support for NEAT training
- Node polyfills for browser compatibility

## Deployment

The app is deployed to Vercel. Production build:

```bash
yarn workspace @heygrady/hexagonoids-app build
```

Output is in `dist/` directory.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
