# hexagonoids

> Asteroids on a Sphere.

A monorepo containing a 3D Asteroids-style game rendered on a hexagonal sphere,
along with a NEAT (NeuroEvolution of Augmenting Topologies) training system that
uses Tic-Tac-Toe as a demonstration environment for evolving neural network
agents.

- [Play Hexagonoids Here](https://hexagonoids.heygrady.com/)
- [Play Tictactoe Here](https://hexagonoids.heygrady.com/experiments/tictactoe)
- [Read Here](https://heygrady.com/posts/2023-07-28-hexagonoids/)

## Purpose

- **3D Game Development**: Explore rendering games on spherical surfaces using
  hexagonal grids (H3) and Babylon.js
- **NEAT Training**: Demonstrate neural network evolution using a simple game
  environment (Tic-Tac-Toe)
- **Tournament Systems**: Implement rating systems (Glicko-2) and tournament
  formats (Swiss) for agent evaluation

## Workspaces

| Package                                                             | Description                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| [@heygrady/hexagonoids-app](./apps/hexagonoids)                     | Main web application (Astro + SolidJS + Babylon.js)         |
| [@heygrady/h3-babylon](./packages/h3-babylon)                       | H3 hexagonal coordinates to Babylon.js Vector3 conversion   |
| [@heygrady/tictactoe-game](./packages/tictactoe-game)               | Pure Tic-Tac-Toe game logic with multiple AI player types   |
| [@heygrady/tictactoe-environment](./packages/tictactoe-environment) | NEAT environment adapter for training agents on Tic-Tac-Toe |
| [@heygrady/tictactoe-demo](./packages/tictactoe-demo)               | Training pipeline and CLI for NEAT agents                   |
| [@heygrady/tournament-strategy](./packages/tournament-strategy)     | Swiss tournament and Glicko-2 rating implementations        |

## Quick Start

### Prerequisites

- Node.js 22.14.0 (managed via [Volta](https://volta.sh/))
- Yarn 3.6.1

### Setup

```bash
# Clone the repository
git clone https://github.com/heygrady/hexagonoids.git
cd hexagonoids

# Install dependencies
yarn install

# Build all packages
yarn build
```

### Development

```bash
# Start the web app dev server
yarn dev

# Run the NEAT training demo
yarn demo

# Play against a trained agent
yarn play
```

### Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn coverage

# Lint all packages
yarn lint

# Format all packages
yarn format
```

## Architecture

```
hexagonoids/
├── apps/
│   └── hexagonoids/          # Main web application
├── packages/
│   ├── h3-babylon/           # H3 ↔ Babylon.js coordinate conversion
│   ├── tictactoe-game/       # Core game logic + AI players
│   ├── tictactoe-environment/# NEAT environment adapter
│   ├── tictactoe-demo/       # Training pipeline + CLI
│   └── tournament-strategy/  # Tournament + rating systems
└── scripts/                  # Build and development scripts
```

### Package Dependencies

```
tictactoe-demo
├── tictactoe-environment
│   ├── tictactoe-game
│   └── tournament-strategy
└── @neat-evolution/* (external)

hexagonoids-app
├── h3-babylon
├── tictactoe-game
└── tictactoe-environment
```

## License

MIT License - see [LICENSE](./LICENSE) for details.
