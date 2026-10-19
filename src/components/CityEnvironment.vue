<template>
  <primitive :object="environment" :dispose="null" />
</template>

<script setup lang="ts">
import { onUnmounted, shallowRef, watch } from 'vue'
import { AdditiveBlending, BoxGeometry, Color, CylinderGeometry, DataTexture, Group, LinearFilter, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, type InstancedMesh } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { cityConfig } from '../config/city'
import { disposeCityInstances, instanceCityParts, type CityPart } from '../utils/cityGeometry'
import type { TrafficPhase } from '../utils/cityTraffic'
import { getCityRoadLayout } from '../utils/cityRoadLayout'

const props = defineProps<{ rows: number; initialPhase: TrafficPhase }>()
let currentPhase = props.initialPhase
let appliedPhase = -1
let signalMesh: InstancedMesh | undefined
let signalFaces: { axis: 'x' | 'z' | 'pedestrian'; lens: number }[] = []
const signalColor = new Color()
const environment = shallowRef(new Group())
const geometry = new BoxGeometry(1, 1, 1)
const curbGeometry = new RoundedBoxGeometry(cityConfig.streets.plotWidth, 1, cityConfig.streets.plotWidth, 2, 0.07)
const poleGeometry = new CylinderGeometry(1, 1, 1, 6)
const signalGeometry = new SphereGeometry(1, 8, 6)
const poolGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const baseMaterial = new MeshStandardMaterial({ color: '#101C2C', roughness: 0.7, metalness: 0.25 })
const asphaltMaterial = new MeshStandardMaterial({ color: cityConfig.streets.asphalt, roughness: 0.9 })
const sidewalkMaterial = new MeshStandardMaterial({ color: cityConfig.streets.sidewalk, roughness: 0.9 })
const curbMaterial = new MeshStandardMaterial({ color: cityConfig.streets.curb, roughness: 0.9 })
const cyanMaterial = new MeshBasicMaterial({ color: cityConfig.streets.cyan })
const violetMaterial = new MeshBasicMaterial({ color: cityConfig.streets.violet })
const markingMaterial = new MeshBasicMaterial({ color: cityConfig.streets.paint })
const centerLineMaterial = new MeshBasicMaterial({ color: cityConfig.streets.centerLine })
const poleMaterial = new MeshStandardMaterial({ color: '#536574', metalness: 0.55, roughness: 0.5 })
const housingMaterial = new MeshStandardMaterial({ color: '#192532', roughness: 0.7 })
const lampMaterial = new MeshBasicMaterial({ color: cityConfig.streets.lampColor, toneMapped: false })
const signalMaterial = new MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false })

const textureSize = 64
const pixels = new Uint8Array(textureSize * textureSize * 4)
for (let y = 0; y < textureSize; y++) {
  for (let x = 0; x < textureSize; x++) {
    const radius = Math.hypot((x + 0.5) / textureSize * 2 - 1, (y + 0.5) / textureSize * 2 - 1)
    const falloff = Math.max(0, 1 - radius)
    pixels.set([255, 255, 255, Math.round(falloff * falloff * 255)], (y * textureSize + x) * 4)
  }
}
const poolTexture = new DataTexture(pixels, textureSize, textureSize)
poolTexture.magFilter = LinearFilter
poolTexture.minFilter = LinearFilter
poolTexture.needsUpdate = true
const poolMaterial = new MeshBasicMaterial({ color: cityConfig.streets.lampColor, map: poolTexture, transparent: true, opacity: 0.28, depthWrite: false, blending: AdditiveBlending, toneMapped: false })

function updateSignals(phase: TrafficPhase) {
  currentPhase = phase
  if (!signalMesh || appliedPhase === phase.id) return
  const colors = cityConfig.streets.trafficLights
  for (const [index, face] of signalFaces.entries()) {
    let color = colors.inactive
    if (face.axis === 'pedestrian') {
      if (face.lens === (phase.walk ? 1 : 0)) color = phase.walk ? colors.green : colors.red
    } else {
      const signal = face.axis === 'x' ? phase.vehicleX : phase.vehicleZ
      const lens = signal === 'red' ? 0 : signal === 'amber' ? 1 : 2
      if (face.lens === lens) color = colors[signal]
    }
    signalMesh.setColorAt(index, signalColor.set(color))
  }
  if (signalMesh.instanceColor) signalMesh.instanceColor.needsUpdate = true
  appliedPhase = phase.id
}

function rebuildEnvironment() {
  const previous = environment.value
  const group = new Group()
  const { columns, spacing, streets } = cityConfig
  const { rows, width, depth, roadWidth, halfRoad } = getCityRoadLayout(props.rows)
  const roads: CityPart[] = []
  const sidewalks: CityPart[] = []
  const curbs: CityPart[] = []
  const cyan: CityPart[] = []
  const violet: CityPart[] = []
  const markings: CityPart[] = []
  const centerLines: CityPart[] = []
  const poles: CityPart[] = []
  const lampMetal: CityPart[] = []
  const housings: CityPart[] = []
  const lamps: CityPart[] = []
  const lightPools: CityPart[] = []
  const signals: CityPart[] = []
  signalFaces = []
  const verticalRoads = Array.from({ length: columns + 1 }, (_, column) => (column - columns / 2) * spacing)
  const horizontalRoads = Array.from({ length: rows + 1 }, (_, row) => (row - rows / 2) * spacing)

  group.add(instanceCityParts([{ position: [0, -0.2, 0], scale: [width, 0.32, depth] }], geometry, baseMaterial))
  for (const x of verticalRoads) {
    roads.push({ position: [x, -0.032, 0], scale: [roadWidth, 0.024, rows * spacing + roadWidth] })
  }
  for (const z of horizontalRoads) {
    roads.push({ position: [0, -0.032, z], scale: [columns * spacing + roadWidth, 0.024, roadWidth] })
  }
  group.add(instanceCityParts(roads, geometry, asphaltMaterial))

  function addStreetlight(x: number, z: number, direction: number) {
    const height = streets.lampHeight
    const size = height / 0.5
    const reach = Math.min(roadWidth * 0.55, height * 0.36)
    const headX = x + direction * reach
    poles.push({ position: [x, height / 2, z], scale: [0.012 * size, height, 0.012 * size] })
    lampMetal.push({ position: [x, 0.02 * size, z], scale: [0.05 * size, 0.04 * size, 0.05 * size] })
    lampMetal.push({ position: [x + direction * reach / 2, height - 0.015 * size, z], scale: [reach, 0.018 * size, 0.018 * size] })
    housings.push({ position: [headX, height - 0.02 * size, z], scale: [0.09 * size, 0.032 * size, 0.055 * size] })
    lamps.push({ position: [headX, height - 0.038 * size, z], scale: [0.07 * size, 0.009 * size, 0.038 * size] })
    lightPools.push({ position: [headX, -0.019, z], scale: [roadWidth * 1.6, 1, height * 1.2] })
  }

  function addTrafficLights(x: number, z: number, column: number, row: number) {
    const { height, inactive } = streets.trafficLights
    const size = height / 0.5
    const lensRadius = 0.016 * size
    for (const side of [-1, 1]) {
      if ((row === 0 && side < 0) || (row === rows && side > 0)) continue
      if ((column === 0 && side > 0) || (column === columns && side < 0)) continue
      const poleX = x - side * (halfRoad + 0.14)
      const poleZ = z + side * (halfRoad + 0.2)
      const laneX = x - side * roadWidth / 4
      const laneZ = z - side * roadWidth / 4
      poles.push({ position: [poleX, height / 2, poleZ], scale: [0.012 * size, height, 0.012 * size] })
      lampMetal.push({ position: [poleX, 0.02, poleZ], scale: [0.055 * size, 0.04, 0.055 * size] })
      lampMetal.push({ position: [(poleX + laneX) / 2, height, poleZ], scale: [Math.abs(laneX - poleX), 0.015 * size, 0.015 * size] })
      lampMetal.push({ position: [poleX, height, (poleZ + laneZ) / 2], scale: [0.015 * size, 0.015 * size, Math.abs(laneZ - poleZ)] })
      for (const vertical of [true, false]) {
        const headX = vertical ? laneX : poleX
        const headZ = vertical ? poleZ : laneZ
        housings.push({ position: [headX, height - 0.06 * size, headZ], scale: vertical ? [0.065 * size, 0.16 * size, 0.05 * size] : [0.05 * size, 0.16 * size, 0.065 * size] })
        for (let lens = 0; lens < 3; lens++) {
          signalFaces.push({ axis: vertical ? 'z' : 'x', lens })
          signals.push({
            position: [headX + (vertical ? 0 : -side * 0.032 * size), height - (0.015 + lens * 0.045) * size, headZ + (vertical ? side * 0.032 * size : 0)],
            scale: [lensRadius, lensRadius, lensRadius],
            color: inactive,
          })
        }
      }
      const pedestrianY = height * 0.53
      housings.push({ position: [poleX, pedestrianY, poleZ], scale: [0.065 * size, 0.105 * size, 0.065 * size] })
      for (const alongX of [true, false]) {
        for (let lens = 0; lens < 2; lens++) {
          signalFaces.push({ axis: 'pedestrian', lens })
          signals.push({
            position: [poleX + (alongX ? -side * 0.037 * size : 0), pedestrianY + (lens === 0 ? 0.024 : -0.024) * size, poleZ + (alongX ? 0 : side * 0.037 * size)],
            scale: [lensRadius * 0.8, lensRadius * 0.8, lensRadius * 0.8],
            color: inactive,
          })
        }
      }
    }
  }

  for (let column = 0; column < columns; column++) {
    const x = (column - (columns - 1) / 2) * spacing
    for (let row = 0; row < rows; row++) {
      const z = (row - (rows - 1) / 2) * spacing
      curbs.push({ position: [x, -0.023, z], scale: [1, 0.034, 1] })
      const inset = (streets.plotWidth - 0.035) / streets.plotWidth
      sidewalks.push({ position: [x, -0.006, z], scale: [inset, 0.012, inset] })
      const corner = streets.plotWidth / 2 - 0.04
      addStreetlight(x - corner, z - corner, -1)
      if ((column + row) % 2 === 0) addStreetlight(x + corner, z + corner, 1)
    }
  }

  function addRoadSegment(vertical: boolean, road: number, from: number, to: number) {
    const start = from + halfRoad
    const end = to - halfRoad
    const middle = (start + end) / 2
    for (const side of [-1, 1]) {
      const edge = road + side * (halfRoad - 0.018)
      markings.push({
        position: vertical ? [edge, -0.017, middle] : [middle, -0.017, edge],
        scale: vertical ? [0.006, 0.006, end - start] : [end - start, 0.006, 0.006],
      })
    }
    const markingClearance = streets.walkingInset + streets.crossingDepth / 2 + 0.17
    for (let cursor = start + markingClearance; cursor < end - markingClearance; cursor += 0.22) {
      centerLines.push({
        position: vertical ? [road, -0.017, cursor] : [cursor, -0.017, road],
        scale: vertical ? [0.008, 0.006, 0.1] : [0.1, 0.006, 0.008],
      })
    }
  }
  for (const x of verticalRoads) {
    for (let row = 0; row < rows; row++) addRoadSegment(true, x, horizontalRoads[row]!, horizontalRoads[row + 1]!)
  }
  for (const z of horizontalRoads) {
    for (let column = 0; column < columns; column++) addRoadSegment(false, z, verticalRoads[column]!, verticalRoads[column + 1]!)
  }

  function addCrosswalk(x: number, z: number, vertical: boolean, side: number) {
    const distance = side * (halfRoad + streets.walkingInset)
    for (let stripe = 0; stripe < 4; stripe++) {
      const offset = (stripe - 1.5) * roadWidth * 0.19
      markings.push({
        position: vertical ? [x + offset, -0.017, z + distance] : [x + distance, -0.017, z + offset],
        scale: vertical ? [roadWidth * 0.1, 0.006, streets.crossingDepth] : [streets.crossingDepth, 0.006, roadWidth * 0.1],
      })
    }
    const stopDistance = side * (halfRoad + streets.walkingInset + streets.crossingDepth / 2 + 0.06)
    markings.push({
      position: vertical ? [x - side * roadWidth / 4, -0.017, z + stopDistance] : [x + stopDistance, -0.017, z + side * roadWidth / 4],
      scale: vertical ? [roadWidth * 0.4, 0.006, 0.012] : [0.012, 0.006, roadWidth * 0.4],
    })
  }
  for (let column = 0; column <= columns; column++) {
    for (let row = 0; row <= rows; row++) {
      const x = verticalRoads[column]!
      const z = horizontalRoads[row]!
      if (row > 0) addCrosswalk(x, z, true, -1)
      if (row < rows) addCrosswalk(x, z, true, 1)
      if (column > 0) addCrosswalk(x, z, false, -1)
      if (column < columns) addCrosswalk(x, z, false, 1)
      addTrafficLights(x, z, column, row)
    }
  }

  for (const side of [-1, 1]) {
    cyan.push({ position: [side * (width / 2 + 0.002), -0.09, 0], scale: [0.014, 0.012, depth - 0.08] })
    violet.push({ position: [0, -0.09, side * (depth / 2 + 0.002)], scale: [width - 0.08, 0.012, 0.014] })
  }

  group.add(instanceCityParts(curbs, curbGeometry, curbMaterial))
  group.add(instanceCityParts(sidewalks, curbGeometry, sidewalkMaterial))
  group.add(instanceCityParts(cyan, geometry, cyanMaterial))
  group.add(instanceCityParts(violet, geometry, violetMaterial))
  group.add(instanceCityParts(markings, geometry, markingMaterial))
  group.add(instanceCityParts(centerLines, geometry, centerLineMaterial))
  group.add(instanceCityParts(poles, poleGeometry, poleMaterial))
  group.add(instanceCityParts(lampMetal, geometry, poleMaterial))
  group.add(instanceCityParts(housings, geometry, housingMaterial))
  group.add(instanceCityParts(lamps, geometry, lampMaterial))
  group.add(instanceCityParts(lightPools, poolGeometry, poolMaterial))
  signalMesh = instanceCityParts(signals, signalGeometry, signalMaterial)
  group.add(signalMesh)
  appliedPhase = -1
  updateSignals(currentPhase)
  environment.value = group
  disposeCityInstances(previous)
}

watch(() => props.rows, rebuildEnvironment, { immediate: true })
defineExpose({ updateSignals })
onUnmounted(() => {
  disposeCityInstances(environment.value)
  geometry.dispose()
  curbGeometry.dispose()
  poleGeometry.dispose()
  signalGeometry.dispose()
  poolGeometry.dispose()
  poolTexture.dispose()
  for (const material of [baseMaterial, asphaltMaterial, sidewalkMaterial, curbMaterial, cyanMaterial, violetMaterial, markingMaterial, centerLineMaterial, poleMaterial, housingMaterial, lampMaterial, signalMaterial, poolMaterial]) material.dispose()
})
</script>
