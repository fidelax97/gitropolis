<template>
  <primitive :object="crowd" :dispose="null" />
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useTresContext } from '@tresjs/core'
import { BoxGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { cityConfig } from '../config/city'
import type { CityTraffic } from '../utils/cityTraffic'

const props = defineProps<{ rows: number; traffic: CityTraffic }>()
const { renderer } = useTresContext()
const config = cityConfig.pedestrians
const geometry = new BoxGeometry(1, 1, 1)
const material = new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, flatShading: true })
const count = Math.max(0, Math.floor(config.count))
const crowd = new InstancedMesh(geometry, material, count * 6)
crowd.instanceMatrix.setUsage(DynamicDrawUsage)
crowd.frustumCulled = false
crowd.raycast = () => {}

interface Waypoint { x: number; z: number; crossing?: boolean }
interface Walker {
  root: Group
  limbs: Group[]
  parts: Object3D[]
  route: Waypoint[]
  segment: number
  distance: number
  wait: number
  phase: number
  speed: number
}
let walkers: Walker[] = []

function makeRoute(index: number): Waypoint[] {
  const { columns, spacing, streets } = cityConfig
  const rows = Math.max(1, props.rows)
  const column = (index * 3 + Math.floor(index / rows)) % Math.max(1, columns - 1)
  const x = (column - (columns - 1) / 2) * spacing
  const z = (index % rows - (rows - 1) / 2) * spacing
  const edge = streets.plotWidth / 2 - streets.walkingInset
  const bevel = 0.12
  const left = x - edge
  const right = x + (columns > 1 ? spacing : 0) + edge
  const north = z - edge
  const south = z + edge
  const road = x + spacing / 2
  const approach = (spacing - streets.plotWidth) / 2 + 0.03
  const points: Waypoint[] = [
    { x: left + bevel, z: north },
    ...(columns > 1 ? [
      { x: road - approach, z: north, crossing: true },
      { x: road + approach, z: north },
    ] : []),
    { x: right - bevel, z: north },
    { x: right, z: north + bevel },
    { x: right, z: south - bevel },
    { x: right - bevel, z: south },
    ...(columns > 1 ? [
      { x: road + approach, z: south, crossing: true },
      { x: road - approach, z: south },
    ] : []),
    { x: left + bevel, z: south },
    { x: left, z: south - bevel },
    { x: left, z: north + bevel },
  ]
  return points
}

function buildCrowd() {
  walkers = []
  const color = new Color()
  for (let index = 0; index < count; index++) {
    const root = new Group()
    const parts: Object3D[] = []
    const limbs: Group[] = []
    const shirt = config.clothing[index % config.clothing.length]!
    const skin = config.skin[index % config.skin.length]!
    const scale = config.height / 0.22 * (0.93 + (index % 4) * 0.035)
    root.scale.setScalar(scale)
    function part(parent: Group, x: number, y: number, z: number, width: number, height: number, depth: number, tint: string) {
      const object = new Object3D()
      object.position.set(x, y, z)
      object.scale.set(width, height, depth)
      parent.add(object)
      crowd.setColorAt(index * 6 + parts.length, color.set(tint))
      parts.push(object)
    }
    part(root, 0, 0.127, 0, 0.043, 0.072, 0.03, shirt)
    part(root, 0, 0.19, 0, 0.037, 0.044, 0.035, skin)
    for (const side of [-1, 1]) {
      const arm = new Group()
      arm.position.set(side * 0.03, 0.156, 0)
      root.add(arm)
      part(arm, 0, -0.034, 0, 0.014, 0.068, 0.018, shirt)
      limbs.push(arm)
    }
    for (const side of [-1, 1]) {
      const leg = new Group()
      leg.position.set(side * 0.012, 0.091, 0)
      root.add(leg)
      part(leg, 0, -0.043, 0, 0.018, 0.086, 0.023, config.trousers)
      limbs.push(leg)
    }
    const route = makeRoute(index)
    const startingSegments = route.map((_, segment) => segment).filter(segment => !route[segment]!.crossing)
    const segment = startingSegments[(index * 5) % startingSegments.length]!
    const from = route[segment]!
    const to = route[(segment + 1) % route.length]!
    walkers.push({ root, parts, limbs, route, segment, distance: Math.hypot(to.x - from.x, to.z - from.z) * ((index * 0.37) % 1), wait: 0, phase: index * 1.7, speed: config.minSpeed + (config.maxSpeed - config.minSpeed) * ((index * 7 % 11) / 10) })
  }
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true
  updateCrowd(0, 0)
  renderer.invalidate()
}

function updateCrowd(delta: number, startTime: number) {
  for (const [index, walker] of walkers.entries()) {
    let remaining = delta
    let waitingForSignal = false
    while (remaining > 0) {
      if (walker.wait > 0) {
        const waited = Math.min(remaining, walker.wait)
        walker.wait -= waited
        remaining -= waited
        if (remaining <= 0) break
      }
      const from = walker.route[walker.segment]!
      const to = walker.route[(walker.segment + 1) % walker.route.length]!
      const length = Math.hypot(to.x - from.x, to.z - from.z)
      if (from.crossing && walker.distance === 0 && !props.traffic.canStartCrossing(startTime + delta - remaining, length / walker.speed)) {
        waitingForSignal = true
        break
      }
      const travelTime = (length - walker.distance) / walker.speed
      const step = Math.min(remaining, travelTime)
      walker.distance += step * walker.speed
      walker.phase += step * walker.speed * 65
      remaining -= step
      if (step >= travelTime) {
        walker.segment = (walker.segment + 1) % walker.route.length
        walker.distance = 0
        if (walker.route[walker.segment]!.crossing) walker.wait = config.crossingWait + (index % 3) * 0.3
      }
    }
    const from = walker.route[walker.segment]!
    const to = walker.route[(walker.segment + 1) % walker.route.length]!
    const length = Math.hypot(to.x - from.x, to.z - from.z)
    const progress = walker.distance / length
    const swing = walker.wait > 0 || waitingForSignal ? 0 : Math.sin(walker.phase) * 0.4
    const groundHeight = from.crossing ? -0.02 * Math.sin(Math.PI * progress) : 0
    walker.root.position.set(from.x + (to.x - from.x) * progress, groundHeight + 0.004, from.z + (to.z - from.z) * progress)
    walker.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z)
    walker.limbs[0]!.rotation.x = swing
    walker.limbs[1]!.rotation.x = -swing
    walker.limbs[2]!.rotation.x = -swing
    walker.limbs[3]!.rotation.x = swing
    walker.root.updateMatrixWorld(true)
    for (const [partIndex, part] of walker.parts.entries()) crowd.setMatrixAt(index * 6 + partIndex, part.matrixWorld)
  }
  crowd.instanceMatrix.needsUpdate = true
}

watch(() => props.rows, buildCrowd, { immediate: true })
defineExpose({ advance: updateCrowd })
onUnmounted(() => {
  crowd.dispose()
  geometry.dispose()
  material.dispose()
  walkers = []
})
</script>
