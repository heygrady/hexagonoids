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

export interface ConeHit {
  distanceNorm: number
  closingSpeed: number
  bearingOffsetNorm: number
  tangentialSpeed: number
}

export interface ObservationFrame {
  shipAlive: boolean
  ship: ShipObservation
  temporal: TemporalObservation
  lidar: ConeHit[]
}
