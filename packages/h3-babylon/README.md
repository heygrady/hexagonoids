# @heygrady/h3-babylon

Utility functions for converting between H3 hexagonal geospatial coordinates and Babylon.js 3D Vector3 coordinates. This enables rendering hexagonal grids on spherical surfaces in 3D space.

[H3](https://h3geo.org/) is Uber's hierarchical hexagonal geospatial indexing system. This package bridges H3's lat/lng coordinate system with Babylon.js's 3D vector space, making it possible to place objects on a sphere using H3 cell IDs.

## Purpose

- **Coordinate Conversion**: Transform between lat/lng, H3 cells, and 3D vectors
- **Spherical Rendering**: Position hexagonal grid cells on 3D spheres
- **Angle Wrapping**: Handle latitude (-90 to 90) and longitude (-180 to 180) wraparound

## How it Fits into the Ecosystem

- **@heygrady/hexagonoids-app**: Uses these utilities to render hexagonal asteroid fields on spherical surfaces

## Installation

```bash
yarn add @heygrady/h3-babylon
```

### Peer Dependencies

This package requires both `@babylonjs/core` and `h3-js`:

```bash
yarn add @babylonjs/core h3-js
```

## Key Components

### Coordinate Conversion

- **`latLngToVector3(lat, lng, radius)`**: Convert latitude/longitude to a 3D point on a sphere
- **`vector3ToLatLng(vector)`**: Convert a 3D vector back to lat/lng coordinates
- **`cellToVector3(h, radius)`**: Convert an H3 cell ID directly to a 3D point
- **`vector3ToCell(vector, resolution)`**: Convert a 3D vector to an H3 cell ID

### Angle Wrapping

- **`wrap90(degrees)`**: Wrap latitude to valid range (-90 to 90)
- **`wrap180(degrees)`**: Wrap longitude to valid range (-180 to 180)

## Usage

### Converting H3 Cells to 3D Positions

```typescript
import { cellToVector3 } from '@heygrady/h3-babylon'
import { latLngToCell } from 'h3-js'

// 1. Get an H3 cell (e.g., San Francisco at resolution 5)
const cell = latLngToCell(37.7749, -122.4194, 5)

// 2. Convert to 3D position on a unit sphere
const radius = 1
const position = cellToVector3(cell, radius)

console.log(position.x, position.y, position.z)
// Use this Vector3 to position a mesh in Babylon.js
```

### Converting Lat/Lng to 3D Vectors

```typescript
import { latLngToVector3, vector3ToLatLng } from '@heygrady/h3-babylon'

// 1. Convert geographic coordinates to 3D
const lat = 40.7128  // New York City
const lng = -74.006
const radius = 10    // Sphere radius

const position = latLngToVector3(lat, lng, radius)
console.log(`3D Position: (${position.x}, ${position.y}, ${position.z})`)

// 2. Convert back to lat/lng (for a normalized vector)
const [newLat, newLng] = vector3ToLatLng(position)
console.log(`Lat/Lng: ${newLat}, ${newLng}`)
```

### Placing Objects on a Sphere

```typescript
import { cellToVector3 } from '@heygrady/h3-babylon'
import { gridDisk } from 'h3-js'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import type { Scene } from '@babylonjs/core/scene'

function createHexagonalGrid(scene: Scene, centerCell: string, sphereRadius: number) {
  // 1. Get a ring of H3 cells around a center point
  const cells = gridDisk(centerCell, 2) // Center + 2 rings

  // 2. Create a mesh at each cell position
  for (const cell of cells) {
    const position = cellToVector3(cell, sphereRadius)

    const marker = MeshBuilder.CreateSphere('marker', { diameter: 0.1 }, scene)
    marker.position = position

    // 3. Orient the marker to face outward from the sphere center
    marker.lookAt(position.scale(2))
  }
}
```

### Handling Coordinate Wraparound

```typescript
import { wrap90, wrap180, latLngToVector3 } from '@heygrady/h3-babylon'

// 1. Wrap coordinates that exceed valid ranges
const rawLat = 100   // Invalid: exceeds 90
const rawLng = 200   // Invalid: exceeds 180

const validLat = wrap90(rawLat)   // Returns wrapped value in [-90, 90]
const validLng = wrap180(rawLng)  // Returns wrapped value in [-180, 180]

console.log(`Wrapped: ${validLat}, ${validLng}`)

// 2. latLngToVector3 automatically wraps coordinates
const position = latLngToVector3(rawLat, rawLng, 1)
// Works correctly even with out-of-range inputs
```

## Coordinate System Notes

- **H3**: Uses WGS84 latitude (-90 to 90) and longitude (-180 to 180) in degrees
- **Babylon.js**: Uses a left-handed Y-up coordinate system (X-right, Y-up, Z-forward)
- **This Package**: Maps latitude to Y-axis elevation, longitude to XZ-plane rotation

## License

MIT License - see [LICENSE](../../LICENSE) for details.
