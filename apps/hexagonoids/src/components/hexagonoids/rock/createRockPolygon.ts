import {
  PolygonMeshBuilder,
  Vector2,
  type Scene,
  type Mesh,
} from '@babylonjs/core'
import earcut from 'earcut'

// https://ronjeffries.com/articles/020-asteroids/asteroids-10/

export const ROCK_1 = [
  new Vector2(0, 2),
  new Vector2(2, 4),
  new Vector2(4, 2),
  new Vector2(3, 0),
  new Vector2(4, -2),
  new Vector2(1, -4),
  new Vector2(-2, -4),
  new Vector2(-4, -2),
  new Vector2(-4, 2),
  new Vector2(-2, 4),
]

// Holes were created using offset-polygon (but it has some bugs)
// https://github.com/Stanko/offset-polygon/issues/2
const ROCK_1_HOLE = [
  new Vector2(0, 1.5757359312880714),
  new Vector2(2, 3.5757359312880714),
  new Vector2(3.6349718460127116, 1.94076408527536),
  new Vector2(2.6645898033750317, 0),
  new Vector2(3.613234179701374, -1.897288752652685),
  new Vector2(0.9091673086804013, -3.7),
  new Vector2(-1.8757359312880713, -3.7),
  new Vector2(-3.7, -1.8757359312880713),
  new Vector2(-3.7, 1.8757359312880713),
  new Vector2(-2, 3.5757359312880714),
]

export const ROCK_2 = [
  new Vector2(2, 1),
  new Vector2(4, 2),
  new Vector2(2, 4),
  new Vector2(0, 3),
  new Vector2(-2, 4),
  new Vector2(-4, 2),
  new Vector2(-3, 0),
  new Vector2(-4, -2),
  new Vector2(-2, -4),
  new Vector2(-1, -3),
  new Vector2(2, -4),
  new Vector2(4, -1),
]

const ROCK_2_HOLE = [
  new Vector2(1.493550489775402, 1.0821854415126695),
  new Vector2(3.4935504897754024, 2.0821854415126695),
  new Vector2(1.94076408527536, 3.6349718460127116),
  new Vector2(0, 2.6645898033750317),
  new Vector2(-1.9407640852753596, 3.6349718460127116),
  new Vector2(-3.6349718460127116, 1.94076408527536),
  new Vector2(-2.6645898033750317, 0),
  new Vector2(-3.6349718460127116, -1.9407640852753596),
  new Vector2(-2, -3.5757359312880714),
  new Vector2(-1.081027227021318, -2.6567631583093894),
  new Vector2(1.8774882225621305, -3.642934974837206),
  new Vector2(3.613961295987389, -1.0382253646993185),
]

export const ROCK_3 = [
  new Vector2(-2, 0),
  new Vector2(-4, -1),
  new Vector2(-2, -4),
  new Vector2(0, -1),
  new Vector2(0, -4),
  new Vector2(2, -4),
  new Vector2(4, -1),
  new Vector2(4, 1),
  new Vector2(2, 4),
  new Vector2(-1, 4),
  new Vector2(-4, 1),
]

const ROCK_3_HOLE = [
  new Vector2(-1.3291796067500634, 0),
  new Vector2(-3.5618785560277164, -1.1163494746388265),
  new Vector2(-2, -3.459167308680401),
  new Vector2(0.2999999999999998, -0.009167308680401831),
  new Vector2(0.3, -3.7),
  new Vector2(1.8394448724536012, -3.7),
  new Vector2(3.7, -0.9091673086804013),
  new Vector2(3.7, 0.9091673086804011),
  new Vector2(1.8394448724536012, 3.7),
  new Vector2(-0.8757359312880713, 3.7),
  new Vector2(-3.4935504897754024, 1.082185441512669),
]

export const ROCK_4 = [
  new Vector2(1, 0),
  new Vector2(4, 1),
  new Vector2(4, 2),
  new Vector2(1, 4),
  new Vector2(-2, 4),
  new Vector2(-1, 2),
  new Vector2(-4, 2),
  new Vector2(-4, -1),
  new Vector2(-2, -4),
  new Vector2(1, -3),
  new Vector2(2, -4),
  new Vector2(4, -2),
]

const ROCK_4_HOLE = [
  new Vector2(0.32321710643676305, 0.09063346816242568),
  new Vector2(3.7, 1.216227766016838),
  new Vector2(3.7, 1.8394448724536012),
  new Vector2(0.9091673086804013, 3.7),
  new Vector2(-1.5145898033750318, 3.7),
  new Vector2(-0.5145898033750318, 1.7000000000000002),
  new Vector2(-3.7, 1.7),
  new Vector2(-3.7, -0.9091673086804013),
  new Vector2(-1.877488222562131, -3.642934974837205),
  new Vector2(1.0810272270213184, -2.6567631583093894),
  new Vector2(2, -3.5757359312880714),
  new Vector2(3.5291084822450034, -2.046627449043068),
]

const rocks: Array<[vertices: Vector2[], hole: Vector2[]]> = [
  [ROCK_1, ROCK_1_HOLE],
  [ROCK_2, ROCK_2_HOLE],
  [ROCK_3, ROCK_3_HOLE],
  [ROCK_4, ROCK_4_HOLE],
]

const getRandomRock = (): [vertices: Vector2[], hole: Vector2[]] => {
  const index = Math.floor(Math.random() * rocks.length)
  return rocks[index]
}

const rockCache = new Map<[vertices: Vector2[], hole: Vector2[]], Mesh>()

export const createRockPolygon = (scene: Scene, id: string): Mesh => {
  const rockData = getRandomRock()

  if (rockCache.has(rockData)) {
    return (rockCache.get(rockData) as Mesh).clone(`rock_${id}`)
  }
  const [rockVertices, rockHole] = rockData

  const rock = new PolygonMeshBuilder(`rock_${id}`, rockVertices, scene, earcut)
  rock.addHole(rockHole)

  const polygon = rock.build()
  rockCache.set(rockData, polygon)
  return polygon
}
