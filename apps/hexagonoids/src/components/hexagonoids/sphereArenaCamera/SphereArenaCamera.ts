import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { BoundingBox } from '@babylonjs/core/Culling/boundingBox'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Plane } from '@babylonjs/core/Maths/math.plane'
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

import { getCommonMaterial } from '../common/commonMaterial'
import { CAMERA_RADIUS } from '../constants'
import { pickPoint } from '../rock/pickPoint'
import { getScreenDimensions } from '../store/player/PlayerActions'

export interface SphereArenaCameraOptions {
  radius: number
  globeRadius: number
  globeMesh: Mesh
  debug?: boolean
}

type CameraPoints = [
  topLeft: Vector3,
  topRight: Vector3,
  bottomLeft: Vector3,
  bottomRight: Vector3,
  center: Vector3,
]

export interface SphereArenaCamera {
  camera: FreeCamera
  originNode: TransformNode
  positionNode: TransformNode
  equatorialPlane: Mesh
  globe: Mesh
  boxNode: Mesh
  points: CameraPoints
}

const createEquatorialPlane = (scene: Scene, camera: FreeCamera) => {
  // Get the camera's field of view (in radians)
  const fov = camera.fov

  // Get the aspect ratio of the camera (width / height)
  const aspectRatio = camera.getEngine().getAspectRatio(camera)

  // Calculate the size of the plane based on the FOV and aspect ratio
  const distanceToPlane = CAMERA_RADIUS
  const size =
    2 *
    distanceToPlane *
    Math.tan(fov / 2) *
    Math.sqrt(1 + aspectRatio * aspectRatio)

  // Create the abstract plane from a position and normal
  const cameraForward = camera.getForwardRay().direction
  const normal = cameraForward.negate()
  const abstractPlane = Plane.FromPositionAndNormal(Vector3.Zero(), normal)

  // Create the plane mesh using the abstract plane
  const plane = CreatePlane(
    'plane',
    {
      sourcePlane: abstractPlane,
      size,
      sideOrientation: Mesh.FRONTSIDE,
    },
    scene
  )
  return plane
}

export const boundingPoints = (
  points: Vector3[]
): [min: Vector3, max: Vector3] => {
  if (points.length === 0) {
    throw new Error('Points array cannot be empty.')
  }

  let minX = points[0].x
  let minY = points[0].y
  let minZ = points[0].z
  let maxX = points[0].x
  let maxY = points[0].y
  let maxZ = points[0].z

  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.z < minZ) minZ = point.z
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
    if (point.z > maxZ) maxZ = point.z
  }

  const min = new Vector3(minX, minY, minZ)
  const max = new Vector3(maxX, maxY, maxZ)

  return [min, max]
}

function boxFromBoundingBox(scene: Scene, boundingBox: BoundingBox): Mesh {
  // Get the minimum and maximum points of the bounding box
  const min = boundingBox.minimum
  const max = boundingBox.maximum

  // Calculate the dimensions of the box
  const width = max.x - min.x
  const height = max.y - min.y
  const depth = max.z - min.z

  // Calculate the center position of the box
  const centerX = (max.x + min.x) / 2
  const centerY = (max.y + min.y) / 2
  const centerZ = (max.z + min.z) / 2

  // Create the box mesh
  const box = CreateBox('box', { width, height, depth }, scene)

  // Set the position of the box based on the bounding box center
  box.position.set(centerX, centerY, centerZ)

  return box
}

export const createSphereArenaCamera = (
  name: string,
  scene: Scene,
  options: SphereArenaCameraOptions
): SphereArenaCamera => {
  const position = Vector3.Up().scaleInPlace(options.radius)

  // Create the camera
  const camera = new FreeCamera(name, position, scene)

  // Set camera properties
  camera.setTarget(Vector3.Zero()) // Camera always faces the origin

  // Configure near/far planes for sphere-based geometry
  // Camera is at radius 7.4, looking at origin
  // Sphere surface is at radius 5.0
  // Distance from camera to sphere surface: ~2.4 units
  camera.minZ = 0.1 // Near plane - prevents ship/rock clipping
  camera.maxZ = 20 // Far plane - narrow range improves depth precision

  // Force camera to recalculate projection matrix (critical for WebGPU)
  camera.getProjectionMatrix(true)

  // Set as active camera for the scene
  scene.activeCamera = camera

  // Create a parent TransformNode for the camera
  const originNode = new TransformNode(`${name}Origin`, scene)
  originNode.rotationQuaternion = Quaternion.Identity()

  const positionNode = new TransformNode(`${name}Position`, scene)
  positionNode.position = position

  positionNode.parent = originNode
  camera.parent = originNode

  const equatorialPlane = createEquatorialPlane(scene, camera)
  equatorialPlane.material = getCommonMaterial(scene, { alpha: 0 })
  equatorialPlane.parent = originNode

  // Use the provided globe mesh instead of creating a duplicate
  const globe = options.globeMesh

  const engine = scene.getEngine()
  // Get screen dimensions in an engine-aware way (WebGL vs WebGPU)
  const [screenWidth, screenHeight] = getScreenDimensions(engine)

  // Debug logging (can be removed if not needed)
  // console.log(`\n=== Camera ${name} Screen Sampling ===`)
  // console.log(`Screen dimensions: ${screenWidth} x ${screenHeight}`)
  // console.log(`Pixel ratio: ${pixelRatio}`)
  // console.log(`Camera position:`, camera.position)
  // console.log(`Camera target:`, camera.getTarget())

  const predicate = (mesh: AbstractMesh) =>
    mesh === globe || mesh === equatorialPlane

  // Sample the 4 corners of the screen and the camera center
  const samplePoints: Array<[x: number, y: number]> = [
    [0, 0], // top left
    [screenWidth, 0], // top right
    [0, screenHeight], // bottom left
    [screenWidth, screenHeight], // bottom right
    [screenWidth / 2, screenHeight / 2], // center
  ]
  const points: Vector3[] = []
  for (const [x, y] of samplePoints) {
    const point = pickPoint(x, y, scene, camera, predicate)
    if (point != null) {
      points.push(point)
    }
    // Note: Corner picks may miss the globe - this is geometrically expected
    // when the viewport extends beyond the sphere's visible area
  }

  // Ensure we have at least some valid points for bounding box calculation
  if (points.length === 0) {
    throw new Error(
      '[SphereArenaCamera] Failed to pick any points on globe mesh - camera may be misconfigured'
    )
  }

  const [minBox, maxBox] = boundingPoints(points)
  const boundingBox = new BoundingBox(minBox, maxBox)
  const boxNode = boxFromBoundingBox(scene, boundingBox)
  boxNode.parent = originNode

  // Debug visualization: show culling box as red wireframe
  if (options.debug === true) {
    const debugMaterial = new StandardMaterial('cullingBoxDebugMaterial', scene)
    debugMaterial.wireframe = true
    debugMaterial.emissiveColor = Color3.Red()
    boxNode.material = debugMaterial
    boxNode.isVisible = true
    console.log('[SphereArenaCamera] Debug mode enabled - culling box visible')
  } else {
    boxNode.isVisible = false
  }

  return {
    camera,
    originNode,
    positionNode,
    equatorialPlane,
    globe,
    boxNode,
    points: points as CameraPoints,
  }
}
