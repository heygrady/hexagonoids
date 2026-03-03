export type EncodingPreset = 'four' | 'five' | 'six' | 'cone8'

export const DEFAULT_ENCODING_PRESET: EncodingPreset = 'four'

export const GLOBAL_FEATURES = 5
export const LIDAR_RAY_COUNT = 16

export function getLidarRayCount(preset: EncodingPreset): number {
  return preset === 'cone8' ? 8 : 16
}

export function getEncodingFeaturesPerRay(preset: EncodingPreset): number {
  switch (preset) {
    case 'four':
    case 'cone8':
      return 4
    case 'five':
      return 5
    case 'six':
      return 6
  }
}

export function getInputCountForEncoding(preset: EncodingPreset): number {
  return (
    GLOBAL_FEATURES +
    getLidarRayCount(preset) * getEncodingFeaturesPerRay(preset)
  )
}

export const INPUT_COUNT = getInputCountForEncoding(DEFAULT_ENCODING_PRESET)

export function isEncodingPreset(value: string): value is EncodingPreset {
  return (
    value === 'four' || value === 'five' || value === 'six' || value === 'cone8'
  )
}
