import { polygonToCells } from 'h3-js'
import type * as martinez from 'martinez-polygon-clipping'
import { bench, describe } from 'vitest'

import { arePolygonsIntersecting } from '../src/components/hexagonoids/colission/detectCollisions'
import { BULLET_RESOLUTION } from '../src/components/hexagonoids/constants'

describe('h3 touching', () => {
  const polygon1 = [
    [17.763790353755322, 94.4141972749924],
    [15.5323989620476, 93.75592359189972],
    [17.692620802147616, 92.87638892695041],
    [17.345376437638883, 93.28009386897897],
    [17.38089468585653, 94.0475467952476],
  ]
  const polygon2 = [
    [14.5948705011897, 92.68658724754691],
    [16.05784475824204, 92.20352359259898],
    [15.006340540718547, 89.87703318497823],
    [13.34238088178484, 91.76832818287706],
    [13.647446483648974, 89.67259278836329],
    [12.288387084367397, 89.47049405744276],
    [10.626191287688531, 91.34281595882592],
    [10.41539745037323, 92.72320316628047],
    [11.441463604917143, 95.01809724253071],
    [13.472996662453294, 95.36750571205738],
    [15.842296349803899, 93.61427095838668],
  ]

  bench('polygonToCells', () => {
    const res = BULLET_RESOLUTION
    polygonToCells(polygon1, res)
    polygonToCells(polygon2, res)
  })
  bench('arePolygonsIntersecting', () => {
    arePolygonsIntersecting(
      [polygon1] as martinez.Polygon,
      [polygon2] as martinez.Polygon
    )
  })
})

describe('h3 not touching', () => {
  const polygon1 = [
    [37.01913459582627, -24.65018736343102],
    [35.93595206457273, -22.10023819336774],
    [35.569034973514476, -24.921595291833547],
    [35.87630642340033, -24.407240441287648],
    [36.60093079441588, -24.26745964412342],
  ]
  const polygon2 = [
    [36.44767857922158, -18.64290270876893],
    [35.1394341690461, -16.505307030324357],
    [35.520525132235655, -15.805352226272884],
    [37.99636283115291, -15.791980703093143],
    [39.70704963874838, -17.265805954722868],
    [38.362593719802156, -18.2190151168971],
    [40.04214500585734, -19.758377820950667],
    [38.816995459986195, -21.90257707734541],
    [36.4741366993571, -22.913839280346636],
    [35.24268923830477, -20.706679856868444],
    [34.283053560433125, -20.882400960154435],
    [33.97238417530373, -18.56657200556531],
  ]
  bench('polygonToCells', () => {
    const res = BULLET_RESOLUTION
    polygonToCells(polygon1, res)
    polygonToCells(polygon2, res)
  })
  bench('arePolygonsIntersecting', () => {
    arePolygonsIntersecting(
      [polygon1] as martinez.Polygon,
      [polygon2] as martinez.Polygon
    )
  })
})
