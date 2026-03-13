# Encoding Redesign: Tangent-Plane Projection

## Core Idea

Project the SOI onto the tangent plane at the ship's position. All measurements happen in flat 2D space from the ship's perspective — no arc distances, no spherical bearing math. Entities are projected onto the plane tangent to the game sphere at the ship center point.

## Current Encoding (37 inputs)

### Ship globals (5)

| # | Name | Range | Notes |
|---|---|---|---|
| 0 | `speedNorm` | [0,1] | `angularVelocity.length() / MAX_SPEED` |
| 1 | `headingForwardDrift` | [-1,1] | Velocity alignment with heading |
| 2 | `headingLateralDrift` | [-1,1] | Velocity perpendicular to heading |
| 3 | `angularVelocityNorm` | [0,1] | `speed / TURN_RATE` — **redundant with speedNorm** |
| 4 | `cooldownNorm` | [0,1] | Time since fire / cooldown period |

`livesNorm` is computed in the observation frame but never encoded.

### Per-cone rock data (4 x 8 cones = 32)

| # | Name | Range | Notes |
|---|---|---|---|
| 0 | proximity | [0,1] | `1 - arcDist/maxVision` |
| 1 | bearingOffsetNorm | [-1,1] | Lateral offset within cone / cone half-width |
| 2 | closingSpeed | [-1,1] | Frame-over-frame distance delta |
| 3 | tangentialSpeed | [-1,1] | Frame-over-frame projection delta |

Problems:
- `closingSpeed` and `tangentialSpeed` require stateful `prevDistances` and `prevProjections` maps, extra Map lookups per tick, and produce zero on the first frame
- `bearingOffsetNorm` is normalized by cone half-width, so the same physical offset maps to different values at different depths
- Arc distance requires `Math.acos`; chord/projected distance is cheaper and equivalent for the NN

## Proposed Encoding (34 inputs)

### Projection model: Orthographic

Use **orthographic projection** (not gnomonic) to project entities onto the ship's tangent plane.

- Orthographic: `d_plane = R * sin(θ)` — compresses distances at the edges
- Gnomonic: `d_plane = R * tan(θ)` — stretches distances at the edges (current `buildRockPerceptionPrecompute` behavior)

Orthographic compression is desirable: close objects get high resolution in the [0,1] range, distant objects are compressed together. This matches what the NN needs — precise data about immediate threats, coarse data about distant ones.

Orthographic is also cheaper: no division by dot product, just cross products with the basis vectors.

### Tangent-plane coordinate frame

Build a local coordinate frame at the ship's surface point:
- **Origin**: ship center on unit sphere
- **Forward (Y+)**: ship heading direction (bearing-rotated north)
- **Right (X+)**: perpendicular to forward, tangent to sphere
- **Up**: surface normal (radially outward — not encoded, used for projection)

Project all entities onto this plane. Positions become (x, y) coordinates. Velocities become (vx, vy) vectors.

### Ship inputs (2)

| # | Name | Range | Notes |
|---|---|---|---|
| 0 | `velocityX` | [-1,1] | Ship velocity projected onto tangent plane, right component |
| 1 | `velocityY` | [-1,1] | Ship velocity projected onto tangent plane, forward component |

Everything else is dropped:
- `speedNorm` / `angularVelocityNorm` — redundant; the NN can derive magnitude from (vx, vy)
- `cooldownNorm` — the agent doesn't need to know fire timing; it can just press fire and the engine handles cooldown. Not useful without recurrent layers.
- `livesNorm` — never encoded, doesn't help micro-decisions
- `noise` — not needed; floating-point variation in coordinates provides natural symmetry breaking

### Per-cone rock inputs (4 x 8 cones = 32)

| # | Name | Range | Notes |
|---|---|---|---|
| 0 | `proximity` | [0,1] | Collision-adjusted inverse distance. 1.0 = surfaces touching. |
| 1 | `bearing` | [-1,1] | Bearing from ship nose to rock in half-turns. 0 = dead ahead, ±1 = directly behind. |
| 2 | `velocityX` | [-1,1] | **Relative** velocity (rock - ship) X on tangent plane |
| 3 | `velocityY` | [-1,1] | **Relative** velocity (rock - ship) Y on tangent plane |

### Proximity: collision-adjusted inverse distance

Project the rock position onto the tangent plane using orthographic projection. The projected distance naturally compresses at the SOI edge, giving the NN high resolution for close threats.

The distance is offset by the combined collision radii of ship and rock so that **1.0 means the surfaces are touching** (collision imminent), not that the centers overlap (which can't happen and is well past collision):

```
effective_dist = orthographic_dist - (ship_radius + rock_radius)
proximity = 1 - clamp(effective_dist / max_vision, 0, 1)
```

When `effective_dist <= 0`, proximity is 1.0 — the rock is colliding. When the rock is at the SOI edge, proximity is near 0.

### Bearing: rotation angle to target

The angle from the ship's nose (heading direction) to the rock, expressed as a fraction of a half-turn. This maps [-180°, +180°] to [-1, +1]:

```
bearing = atan2(localX, localY) / PI
```

- `0` = rock is dead ahead
- `+0.5` = rock is 90° to the right
- `-0.5` = rock is 90° to the left
- `±1` = rock is directly behind

This is **cone-independent** — it's purely how far the ship would need to rotate to point at the rock. The cone assignment determines which slot the data goes into, but the bearing value is a global, continuous signal. The NN can directly translate bearing to turn direction without needing to learn which cone index maps to which spatial region.

### Velocity: relative, 2D, stateless

Use **relative velocity** (rock angular velocity minus ship angular velocity), projected onto the ship's tangent plane as (vx, vy).

- **Relative** (not absolute): If both rock and ship move right at the same speed, relative velocity is zero — the NN correctly sees no collision course. Absolute velocity would force the NN to subtract ship inputs from rock inputs internally.
- **2D** (not 3D): The radial (Z) component represents sphere curvature, which is noise from the agent's perspective. Surface movement is what matters.
- **Stateless**: Computed from `rock.angularVelocity` and `ship.angularVelocity` directly. No `prevDistances` map, no `prevProjections` map, no Map lookups, no frame-1 blindness.

## Summary

| Section | Current | Proposed |
|---|---|---|
| Ship inputs | 5 | 2 |
| Per-cone inputs | 4 | 4 |
| Cones | 8 | 8 |
| **Total inputs** | **37** | **34** |
| Stateful maps | 2 (`prevDistances`, `prevProjections`) | 0 |
| Trig calls per rock | `Math.acos` + `Math.tan` | `Math.atan2` only (for bearing) |
| Frame-1 blindness | Yes (closing/tangential = 0) | No |

## Decisions

1. **Velocity: relative** — do the subtraction for the NN
2. **Velocity: 2D projected** — radial Z is sphere curvature noise
3. **No noise channel** — floating-point variation is sufficient
4. **Ship inputs: 2** — just (vx, vy); everything else is derivable or unnecessary
5. **Cooldown: dropped** — not useful without recurrent layers
6. **Proximity: collision-adjusted** — 1.0 means surfaces touching, offset by combined radii
7. **Bearing: half-turns** — [-1, +1] maps to [-180°, +180°], cone-independent continuous signal

## Next Steps

- Rewrite `inspect-inputs.js` to validate the new encoding against scenarios
- Implement orthographic projection in `buildRockPerceptionPrecompute`
- Implement collision-adjusted proximity
- Implement bearing as half-turns
- Implement relative velocity projection for rock cone inputs
- Implement ship velocity projection
- Update `encodingPresets.ts` (GLOBAL_FEATURES = 2, INPUT_COUNT = 34)
- Update `encodeGameState.ts` and `collectObservations.ts`
- Remove `prevDistances` / `prevProjections` plumbing from simulation loops
