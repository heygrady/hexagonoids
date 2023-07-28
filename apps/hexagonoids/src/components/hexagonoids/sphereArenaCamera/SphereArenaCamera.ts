import {
  FreeCamera,
  Vector3,
  type Scene,
  TransformNode,
  Quaternion,
  Plane,
  MeshBuilder,
  Mesh,
  BoundingBox,
  type AbstractMesh,
} from '@babylonjs/core'

import { getCommonMaterial } from '../common/commonMaterial'
import { CAMERA_RADIUS } from '../constants'
import { pickPoint } from '../rock/pickPoint'

export interface SphereArenaCameraOptions {
  radius: number
  globeRadius: number
}

type CameraPoints = [
  topLeft: Vector3,
  topRight: Vector3,
  bottomLeft: Vector3,
  bottomRight: Vector3,
  center: Vector3
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
  const plane = MeshBuilder.CreatePlane(
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
  const box = MeshBuilder.CreateBox('box', { width, height, depth }, scene)

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

  const globe = MeshBuilder.CreateSphere(
    'globe',
    { diameter: options.globeRadius * 2, segments: 32 },
    scene
  )
  globe.material = getCommonMaterial(scene, { alpha: 0 })
  globe.position = new Vector3(0, 0, 0)
  globe.parent = originNode

  const engine = scene.getEngine()
  const pixelRatio = window?.devicePixelRatio ?? 1
  const screenWidth = engine.getRenderWidth() / pixelRatio - pixelRatio
  const screenHeight = engine.getRenderHeight() / pixelRatio - pixelRatio

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
    const point = pickPoint(x, y, scene, camera, predicate) as Vector3
    points.push(point)
  }

  const [minBox, maxBox] = boundingPoints(points)
  const boundingBox = new BoundingBox(minBox, maxBox)
  const boxNode = boxFromBoundingBox(scene, boundingBox)
  boxNode.isVisible = false
  boxNode.parent = originNode

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
