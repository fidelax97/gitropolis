import { cityConfig } from '../config/city'

type VehicleSignal = 'red' | 'amber' | 'green'
export interface TrafficPhase {
  id: number
  vehicleX: VehicleSignal
  vehicleZ: VehicleSignal
  walk: boolean
}

export function createCityTraffic() {
  const { streets, pedestrians, spacing } = cityConfig
  const timing = streets.trafficLights
  const crossingDistance = spacing - streets.plotWidth + 0.06
  const clearance = crossingDistance / pedestrians.minSpeed + timing.safetyBufferSeconds
  const phases: (TrafficPhase & { duration: number })[] = [
    { id: 0, duration: timing.greenSeconds, vehicleX: 'red', vehicleZ: 'green', walk: false },
    { id: 1, duration: timing.amberSeconds, vehicleX: 'red', vehicleZ: 'amber', walk: false },
    { id: 2, duration: timing.vehicleClearanceSeconds, vehicleX: 'red', vehicleZ: 'red', walk: false },
    { id: 3, duration: timing.walkSeconds, vehicleX: 'red', vehicleZ: 'red', walk: true },
    { id: 4, duration: clearance, vehicleX: 'red', vehicleZ: 'red', walk: false },
    { id: 5, duration: timing.greenSeconds, vehicleX: 'green', vehicleZ: 'red', walk: false },
    { id: 6, duration: timing.amberSeconds, vehicleX: 'amber', vehicleZ: 'red', walk: false },
    { id: 7, duration: timing.vehicleClearanceSeconds, vehicleX: 'red', vehicleZ: 'red', walk: false },
    { id: 8, duration: timing.walkSeconds, vehicleX: 'red', vehicleZ: 'red', walk: true },
    { id: 9, duration: clearance, vehicleX: 'red', vehicleZ: 'red', walk: false },
  ]
  const cycleSeconds = phases.reduce((sum, phase) => sum + phase.duration, 0)
  function locate(time: number) {
    let remaining = time % cycleSeconds
    for (const phase of phases) {
      if (remaining < phase.duration) return { phase, remaining: phase.duration - remaining }
      remaining -= phase.duration
    }
    return { phase: phases[0]!, remaining: phases[0]!.duration }
  }
  return {
    phaseAt: (time: number): TrafficPhase => locate(time).phase,
    canEnterJunction(time: number, axis: 'x' | 'z', crossingSeconds: number): boolean {
      const { phase, remaining } = locate(time)
      const signal = axis === 'x' ? phase.vehicleX : phase.vehicleZ
      return signal === 'green' && crossingSeconds + timing.safetyBufferSeconds <= remaining + timing.amberSeconds + timing.vehicleClearanceSeconds
    },
    canStartCrossing(time: number, crossingSeconds: number): boolean {
      const { phase, remaining } = locate(time)
      return phase.walk && crossingSeconds + timing.safetyBufferSeconds <= remaining + clearance
    },
  }
}

export type CityTraffic = ReturnType<typeof createCityTraffic>
