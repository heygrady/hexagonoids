export interface ShipObservation {
  speedNorm: number
  headingForwardDrift: number
  headingLateralDrift: number
  angularVelocityNorm: number
}

export interface TemporalObservation {
  cooldownNorm: number
  livesNorm: number
}

export interface LidarHit {
  distanceNorm: number
  closingSpeed: number
  rockSizeNorm: number
  bearingOffsetNorm: number
  centerWeight: number
  bearingDriftNorm: number
  tangentialSpeed: number
}

export interface ObservationFrame {
  shipAlive: boolean
  ship: ShipObservation
  temporal: TemporalObservation
  lidar: LidarHit[]
}
