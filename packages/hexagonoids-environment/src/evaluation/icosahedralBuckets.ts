/**
 * Compatibility wrapper: the icosahedral bucket implementation now lives in
 * `@heygrady/hexagonoids-engine` so the engine owns the shared sphere math.
 */
export {
  BUCKET_SYSTEM,
  findBucketXYZ,
} from '@heygrady/hexagonoids-engine'
