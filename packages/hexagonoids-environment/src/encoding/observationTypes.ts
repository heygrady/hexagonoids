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
  isRock: number
  isBullet: number
}

export interface ObservationFrame {
  shipAlive: boolean
  ship: ShipObservation
  temporal: TemporalObservation
  lidar: LidarHit[]
}
