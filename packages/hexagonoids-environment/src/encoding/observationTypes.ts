export interface ShipObservation {
  velocityX: number // [-1,1] tangent-plane right component / MAX_SPEED
  velocityY: number // [-1,1] tangent-plane forward component / MAX_SPEED
}

export interface ConeHit {
  proximity: number // [0,1] collision-adjusted (1.0 = surfaces touching)
  bearing: number // [-1,1] half-turns from nose (0=ahead, ±1=behind)
  velocityX: number // [-1,1] relative velocity right / MAX_CLOSING_SPEED
  velocityY: number // [-1,1] relative velocity forward / MAX_CLOSING_SPEED
}

export interface ObservationFrame {
  shipAlive: boolean
  ship: ShipObservation
  lidar: ConeHit[]
}
