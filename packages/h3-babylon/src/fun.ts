import { latLngToCell } from 'h3-js'

type Output = [number, number, number, number, number] // [baseCell, resolution, x, y, z]

interface Prediction {
  baseCell: number
  resolution: number
  x: number
  y: number
  z: number
  lat: number
  lng: number
  h3Index: string
}

export function parseH3Index(h3Index: string): any {
  // Convert the hexadecimal index to a binary string
  const binaryString = BigInt('0x' + h3Index)
    .toString(2)
    .padStart(64, '0')

  // Extract parts of the H3 index
  const reserved = binaryString.substring(0, 4)
  const mode = binaryString.substring(4, 8)
  const modeDependent = binaryString.substring(8, 16)
  const resolution = binaryString.substring(16, 20)
  const baseCell = binaryString.substring(20, 25)

  // Extract digits
  const digits = []
  for (let i = 25; i < 64; i += 3) {
    digits.push(binaryString.substring(i, i + 3))
  }

  return {
    reserved,
    mode,
    modeDependent,
    resolution: parseInt(resolution, 2),
    baseCell: parseInt(baseCell, 2),
    digits: digits.map((digit) => parseInt(digit, 2)),
  }
}

export function parseOutput(output: Output): Prediction {
  const [baseCell, resolution, x, y, z] = output

  // Normalize x, y, z to lie on the unit sphere
  const magnitude = Math.sqrt(x * x + y * y + z * z)
  const normalizedX = x / magnitude
  const normalizedY = y / magnitude
  const normalizedZ = z / magnitude

  // Convert Cartesian coordinates to latitude and longitude
  const lat = Math.asin(normalizedZ / 1) * (180 / Math.PI)
  const lng = Math.atan2(normalizedY, normalizedX) * (180 / Math.PI)

  // Map baseCell and resolution to their valid ranges
  const validBaseCell = Math.round(Math.min(Math.max(baseCell, 0), 127))
  const validResolution = Math.round(Math.min(Math.max(resolution, 0), 15))

  // Compute the H3 index
  const h3Index = latLngToCell(lat, lng, validResolution)

  return {
    baseCell: validBaseCell,
    resolution: validResolution,
    x: normalizedX,
    y: normalizedY,
    z: normalizedZ,
    lat,
    lng,
    h3Index,
  }
}
