<template>
  <primitive :object="fleet" :dispose="null" />
</template>

<script setup lang="ts">
import { onUnmounted, shallowRef, watch } from 'vue'
import { useTresContext } from '@tresjs/core'
import { BoxGeometry, CylinderGeometry, DynamicDrawUsage, Group, MeshBasicMaterial, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three'
import { cityConfig } from '../config/city'
import { disposeCityInstances, instanceCityParts, type CityPart } from '../utils/cityGeometry'
import type { CityTraffic } from '../utils/cityTraffic'
import { createCarRoutes, sampleCarRoute, type CarRoute } from '../utils/cityCarRoutes'

const props = defineProps<{ rows: number; traffic: CityTraffic }>()
const { renderer } = useTresContext()
const config = cityConfig.cars
const geometry = new BoxGeometry(1, 1, 1)
const wheelGeometry = new CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2)
const bodyMaterial = new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4, metalness: 0.3 })
const wheelMaterial = new MeshStandardMaterial({ color: '#18202B', roughness: 0.9 })
const lightMaterial = new MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false })
const fleet = shallowRef(new Group())
let bodyMesh: InstancedMesh | undefined
let wheelMesh: InstancedMesh | undefined
let lightMesh: InstancedMesh | undefined

interface Car {
  root: Group
  route: CarRoute
  bodies: Object3D[]
  wheels: Object3D[]
  lights: Object3D[]
  legIndex: number
  distance: number
  admitted: boolean
  speed: number
}
let cars: Car[] = []
const occupiedEdges = new Map<string, Car>()
const occupiedJunctions = new Map<string, Car>()

function rebuildCars() {
  const previous = fleet.value
  const group = new Group()
  const routes = createCarRoutes(props.rows)
  const bodies: CityPart[] = []
  const wheels: CityPart[] = []
  const lights: CityPart[] = []
  cars = []
  occupiedEdges.clear()
  occupiedJunctions.clear()
  for (const [index, route] of routes.slice(0, Math.max(0, Math.floor(config.count))).entries()) {
    const root = new Group()
    const bodyObjects: Object3D[] = []
    const wheelObjects: Object3D[] = []
    const lightObjects: Object3D[] = []
    const color = config.colors[index % config.colors.length]!
    const { width, height, length } = config
    function part(objects: Object3D[], parts: CityPart[], position: CityPart['position'], scale: CityPart['scale'], tint?: string) {
      const object = new Object3D()
      object.position.set(...position)
      object.scale.set(...scale)
      root.add(object)
      objects.push(object)
      parts.push({ position, scale, color: tint })
    }
    part(bodyObjects, bodies, [0, height * 0.43, 0], [width, height * 0.44, length], color)
    part(bodyObjects, bodies, [0, height * 0.81, -length * 0.03], [width * 0.8, height * 0.34, length * 0.48], '#183447')
    part(bodyObjects, bodies, [0, height * 0.98, -length * 0.03], [width * 0.83, height * 0.06, length * 0.5], color)
    for (const side of [-1, 1]) {
      part(bodyObjects, bodies, [0, height * 0.3, side * length / 2], [width * 0.94, height * 0.14, 0.016], '#34404D')
      for (const end of [-1, 1]) {
        part(wheelObjects, wheels, [side * width / 2, height * 0.2, end * length * 0.31], [0.025, height * 0.2, height * 0.2])
      }
      part(lightObjects, lights, [side * width * 0.31, height * 0.47, length / 2 + 0.004], [width * 0.2, height * 0.12, 0.009], config.headlights)
      part(lightObjects, lights, [side * width * 0.31, height * 0.47, -length / 2 - 0.004], [width * 0.2, height * 0.12, 0.009], config.taillights)
    }
    const legIndex = ((index * 3) % (route.legs.length / 2)) * 2 + 1
    const leg = route.legs[legIndex]!
    const car: Car = { root, route, bodies: bodyObjects, wheels: wheelObjects, lights: lightObjects, legIndex, distance: leg.length / 2, admitted: false, speed: config.minSpeed + (config.maxSpeed - config.minSpeed) * ((index * 3 % 7) / 6) }
    cars.push(car)
    occupiedEdges.set(leg.edge, car)
  }
  bodyMesh = instanceCityParts(bodies, geometry, bodyMaterial)
  wheelMesh = instanceCityParts(wheels, wheelGeometry, wheelMaterial)
  lightMesh = instanceCityParts(lights, geometry, lightMaterial)
  for (const mesh of [bodyMesh, wheelMesh, lightMesh]) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    group.add(mesh)
  }
  writeMatrices()
  fleet.value = group
  disposeCityInstances(previous)
  renderer.invalidate()
}

function advance(delta: number, startTime: number) {
  const releases: { junction: string; incomingEdge: string; car: Car }[] = []
  for (const car of cars) {
    let remaining = delta
    while (remaining > 0) {
      const leg = car.route.legs[car.legIndex]!
      if (leg.kind === 'junction' && !car.admitted) {
        const junctionOwner = occupiedJunctions.get(leg.junction!)
        const outgoingOwner = occupiedEdges.get(leg.edge)
        if (junctionOwner || (outgoingOwner && outgoingOwner !== car)) break
        if (!props.traffic.canEnterJunction(startTime + delta - remaining, leg.axis, leg.length / car.speed)) break
        occupiedJunctions.set(leg.junction!, car)
        occupiedEdges.set(leg.edge, car)
        car.admitted = true
      }
      const travelTime = Math.max(0, leg.length - car.distance) / car.speed
      const step = Math.min(remaining, travelTime)
      car.distance += step * car.speed
      for (const wheel of car.wheels) wheel.rotation.x += step * car.speed / (config.height * 0.2)
      remaining -= step
      if (step >= travelTime) {
        if (leg.kind === 'junction') {
          releases.push({ junction: leg.junction!, incomingEdge: leg.incomingEdge!, car })
          car.admitted = false
        }
        car.legIndex = (car.legIndex + 1) % car.route.legs.length
        car.distance = 0
      }
    }
  }
  for (const release of releases) {
    if (occupiedJunctions.get(release.junction) === release.car) occupiedJunctions.delete(release.junction)
    if (occupiedEdges.get(release.incomingEdge) === release.car) occupiedEdges.delete(release.incomingEdge)
  }
  writeMatrices()
}

function writeMatrices() {
  let bodyIndex = 0
  let wheelIndex = 0
  let lightIndex = 0
  for (const car of cars) {
    const pose = sampleCarRoute(car.route.legs[car.legIndex]!, car.distance)
    car.root.position.set(pose.x, -0.02, pose.z)
    car.root.rotation.y = pose.yaw
    car.root.updateMatrixWorld(true)
    for (const part of car.bodies) bodyMesh?.setMatrixAt(bodyIndex++, part.matrixWorld)
    for (const part of car.wheels) wheelMesh?.setMatrixAt(wheelIndex++, part.matrixWorld)
    for (const part of car.lights) lightMesh?.setMatrixAt(lightIndex++, part.matrixWorld)
  }
  for (const mesh of [bodyMesh, wheelMesh, lightMesh]) if (mesh) mesh.instanceMatrix.needsUpdate = true
}

watch(() => props.rows, rebuildCars, { immediate: true })
defineExpose({ advance })
onUnmounted(() => {
  disposeCityInstances(fleet.value)
  geometry.dispose()
  wheelGeometry.dispose()
  bodyMaterial.dispose()
  wheelMaterial.dispose()
  lightMaterial.dispose()
  cars = []
  occupiedEdges.clear()
  occupiedJunctions.clear()
})
</script>
