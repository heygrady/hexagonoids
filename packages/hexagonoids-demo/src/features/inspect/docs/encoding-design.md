# Encoding design

How game state is transformed into neural network inputs and how network outputs are transformed back into game actions.

## Input encoding

Source: [`encodeGameState.ts`](../../../../hexagonoids-environment/src/encoding/encodeGameState.ts), [`collectObservations.ts`](../../../../hexagonoids-environment/src/encoding/collectObservations.ts), [`encodingPresets.ts`](../../../../hexagonoids-environment/src/encoding/encodingPresets.ts)

### Constants

```ts
CONE_COUNT = 8              // angular slices of the hemisphere
ROCKS_PER_CONE = 2          // top-2 closest rocks per cone
FEATURES_PER_ROCK = 4       // proximity, bearing, velocityX, velocityY
FEATURES_PER_CONE = 8       // ROCKS_PER_CONE × FEATURES_PER_ROCK
BULLET_SLOTS = 6            // max bullets tracked
FEATURES_PER_BULLET = 4     // same features as rocks
GLOBAL_FEATURES = 2         // ship velocityX, velocityY
INPUT_COUNT = 90            // 2 + 8×8 + 6×4
```

### Layout

```
Index   Feature                    Range      Source
─────   ───────                    ─────      ──────
0       ship velocityX (right)     [-1, 1]    angularVelocity projected onto tangent plane / MAX_SPEED
1       ship velocityY (forward)   [-1, 1]    same, forward component

2..65   Rock LIDAR (8 cones × 2 rocks × 4 features)
        For cone c, rock r, feature f:
          index = 2 + c×8 + r×4 + f

        f=0  proximity               [-1, 1]    collision-adjusted distance (see below)
        f=1  bearing                  [-1, 1]    half-turns from nose: atan2(localX, localY) / π
        f=2  velocityX (right)        [-1, 1]    relative velocity / MAX_CLOSING_SPEED
        f=3  velocityY (forward)      [-1, 1]    relative velocity / MAX_CLOSING_SPEED

66..89  Bullet slots (6 × 4 features, same as rocks)
```

### Proximity function

```
effectiveDist = max(0, orthographicDist - shipRadius - rockRadius)

if effectiveDist ≤ bulletRange:
    proximity = 1 - effectiveDist / bulletRange        # [0, 1] — in firing range
else:
    proximity = -(effectiveDist - bulletRange) / (1 - bulletRange)  # [-1, 0) — beyond range
```

- `1.0` = touching (after subtracting entity radii)
- `0.0` = exactly at bullet range (the zero-crossing)
- `-1.0` = at hemisphere edge (maximum visible distance)
- Empty slots = `0.0` (no detection)

**Design note**: The zero-crossing at bullet range means "no rock" (0.0) is indistinguishable from "rock at bullet range" (also 0.0) in the input value. The network must use context (are other features non-zero in this slot?) to distinguish. This is fine for networks with hidden layers but creates ambiguity for direct input-output mappings.

### Coordinate system

The encoding uses orthographic projection onto the ship's tangent plane:

1. Build a local basis at the ship's position on the unit sphere (north + east vectors perpendicular to the surface normal)
2. Rotate the basis by the ship's bearing (yaw → bearing conversion)
3. Project each entity's 3D position onto this 2D plane: `localX = dot(entity, right)`, `localY = dot(entity, forward)`

This is a flat projection of a curved surface. It works well within the sphere of influence (SOI ≈ 30°) but distorts at the edges. The orthographic projection (no perspective division) keeps the math simple and the values bounded.

### Cone assignment

The hemisphere is divided into 8 equal angular cones (45° each):

```
coneIndex = floor((atan2(localX, localY) + π) / (2π) × 8) % 8
```

Cone 0 starts at -180° (directly behind), cone 4 is 0° (dead ahead). Each cone stores the 2 rocks with the highest proximity (closest first). Additional rocks in the same cone are discarded.

### Memory system

Source: `scanMemoryRocks` in [`collectObservations.ts`](../../../../hexagonoids-environment/src/encoding/collectObservations.ts)

The agent tracks a `Set<string>` of rock IDs it has previously observed within the SOI. When a cone has empty slots after scanning SOI rocks, the memory system:

1. Re-projects remembered rocks onto the tangent plane
2. Fills empty cone slots with real (current-tick) positional data
3. Prunes rocks that have been destroyed or moved behind the hemisphere

This gives the agent awareness of rocks that left the SOI but are still alive, without requiring recurrent memory in the network itself.

## Output decoding

Source: [`decodeOutputs.ts`](../../../../hexagonoids-environment/src/encoding/decodeOutputs.ts)

4 outputs → 4 boolean actions:

```ts
const ACTIVATION_THRESHOLD = 0.75

thrust = outputs[0] > 0.75
fire   = outputs[1] > 0.75
left   = outputs[2] > 0.75
right  = outputs[3] > 0.75
```

When both left and right exceed 0.75, only the stronger wins (mutual exclusion). This prevents the "both buttons pressed" no-op.

### Output activation

The default output activation is `Activation.Sigmoid`, which maps any real number to (0, 1). The threshold at 0.75 means:

- Pre-activation value < ~1.1 → output < 0.75 → button not pressed
- Pre-activation value > ~1.1 → output > 0.75 → button pressed

With random initial weights centered at 0 and Sigmoid activation, the expected output is ~0.5 — below the threshold. The agent does nothing until mutations push weights high enough.

### Alternative: continuous outputs

The current system uses binary thresholding. An alternative would be to use continuous outputs:

- **Thrust**: output value = thrust magnitude (0 = none, 1 = full)
- **Turn**: single output mapped to steering angle (-1 = full left, 0 = straight, 1 = full right)
- **Fire**: continuous fire rate or probability

This would provide smoother gradient signal to evolution and eliminate the threshold wall described in [evaluation-pipeline.md](./evaluation-pipeline.md). However, it would require changes to the game engine's input model (currently boolean-based).

## Relationship to the evaluation pipeline

The encoding feeds into the agent, which feeds into the evaluation loop. The chain is:

```
encodeGameState → 90 floats
executor.execute → 4 floats (sigmoid outputs in [0, 1])
decodeOutputs   → 4 booleans
game engine     → next state → RawMetrics
fitness scoring → see fitness.md
```

The `inspect inputs` tool validates the first stage (encoding). The `inspect fitness` tool validates the last stage (scoring). The middle stages (executor forward pass, output decoding) are not directly inspectable today — you'd need to add console.log statements in the agent wrapper or build a dedicated output inspector.
