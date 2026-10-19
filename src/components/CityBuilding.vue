<template>
  <TresGroup :position="building.position" :dispose="null" @pointerenter="emit('hover', building.date)" @pointermove="emit('hover', building.date)" @pointerleave="emit('hover', null)" @click="emit('select', building.date)">
    <TresMesh v-if="building.count === 0" :geometry="geometry" :material="selected ? material : forestGroundMaterial" :scale="[building.width, building.height, building.depth]" :dispose="null" />
    <TresMesh v-for="(section, index) in sections" :key="index" :geometry="geometry" :material="material" :position="[0, section.bottom + section.height / 2, 0]" :scale="[section.width, section.height, section.depth]" :dispose="null" />
    <primitive :object="details" :dispose="null" />
  </TresGroup>
</template>

<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { Group, type BoxGeometry, type ConeGeometry, type MeshBasicMaterial, type MeshStandardMaterial } from 'three'
import type { CityBuilding } from '../types/city'
import { cityConfig } from '../config/city'
import { disposeCityInstances, instanceCityParts, type CityPart } from '../utils/cityGeometry'

const props = defineProps<{
  building: CityBuilding
  geometry: BoxGeometry
  material: MeshStandardMaterial
  windowMaterial: MeshBasicMaterial
  frameMaterial: MeshBasicMaterial
  rooftopMaterial: MeshStandardMaterial
  foliageGeometry: ConeGeometry
  forestMaterial: MeshStandardMaterial
  forestGroundMaterial: MeshStandardMaterial
  selected: boolean
}>()
const emit = defineEmits<{ hover: [date: string | null]; select: [date: string] }>()
const details = shallowRef(new Group())

interface BuildingSection {
  width: number
  depth: number
  height: number
  bottom: number
}

const sections = computed<BuildingSection[]>(() => {
  const { width, depth, height, profile, count } = props.building
  if (count === 0) return []
  const bottom = -height / 2
  if (profile !== 'stepped') return [{ width, depth, height, bottom }]
  const { upperScale, lowerHeightRatio } = cityConfig.architecture.profiles.stepped
  const lowerHeight = height * lowerHeightRatio
  return [
    { width, depth, height: lowerHeight, bottom },
    { width: width * upperScale, depth: depth * upperScale, height: height - lowerHeight, bottom: bottom + lowerHeight },
  ]
})

function rebuildDetails() {
  const previous = details.value
  const group = new Group()
  const { height, count, seed } = props.building
  if (count > 0) {
    const { architecture, footprint } = cityConfig
    const windows: CityPart[] = []
    const frames: CityPart[] = []
    const roofs: CityPart[] = []

    for (const [sectionIndex, section] of sections.value.entries()) {
      const { width, depth, bottom } = section
      const top = bottom + section.height
      const halfWidth = width / 2
      const halfDepth = depth / 2
      const floors = Math.max(1, Math.floor((section.height - 0.18) / architecture.floorHeight))

      for (let floor = 0; floor < floors; floor++) {
        const y = bottom + 0.18 + floor * architecture.floorHeight
        for (let side = 0; side < 4; side++) {
          const alongX = side < 2
          const span = alongX ? width : depth
          const columnCount = Math.max(2, Math.round(architecture.windowsPerSide * span / footprint))
          const windowWidth = Math.min(0.1, span / (columnCount + 0.5) * 0.55)
          const wall = (side % 2 === 0 ? 1 : -1) * ((alongX ? halfDepth : halfWidth) + 0.004)
          for (let column = 0; column < columnCount; column++) {
            const offset = (column - (columnCount - 1) / 2) * (span / (columnCount + 0.5))
            const noise = ((seed ^ Math.imul(sectionIndex * 97 + floor * 19 + column * 7 + side * 37 + 1, 2654435761)) >>> 0) % 100
            const color = noise < 38 ? architecture.windows.unlit : noise < 77 ? architecture.windows.warm : architecture.windows.cool
            windows.push({
              position: alongX ? [offset, y, wall] : [wall, y, offset],
              scale: alongX ? [windowWidth, 0.085, 0.008] : [0.008, 0.085, windowWidth],
              color,
            })
          }
        }
      }

      const thickness = architecture.frameThickness
      for (const x of [-halfWidth, halfWidth]) {
        for (const z of [-halfDepth, halfDepth]) frames.push({ position: [x, bottom + section.height / 2, z], scale: [thickness, section.height, thickness] })
      }
      for (let floor = 0; floor < floors; floor += 3) {
        const y = bottom + floor * architecture.floorHeight + 0.04
        for (const side of [-1, 1]) {
          frames.push({ position: [0, y, side * (halfDepth + 0.007)], scale: [width, thickness * 0.65, thickness] })
          frames.push({ position: [side * (halfWidth + 0.007), y, 0], scale: [thickness, thickness * 0.65, depth] })
        }
      }
      for (const side of [-1, 1]) {
        frames.push({ position: [0, top + 0.035, side * halfDepth], scale: [width + 0.025, thickness, thickness] })
        frames.push({ position: [side * halfWidth, top + 0.035, 0], scale: [thickness, thickness, depth + 0.025] })
      }
      roofs.push({ position: [0, top + 0.015, 0], scale: [width + 0.025, 0.03, depth + 0.025] })
    }

    const roof = sections.value[sections.value.length - 1]!
    const top = height / 2
    roofs.push({ position: [-roof.width * 0.17, top + 0.09, roof.depth * 0.15], scale: [roof.width * 0.3, 0.12, roof.depth * 0.25] })
    roofs.push({ position: [roof.width * 0.21, top + 0.07, -roof.depth * 0.18], scale: [roof.width * 0.18, 0.08, roof.depth * 0.27] })
    for (let fin = 0; fin < 4; fin++) roofs.push({ position: [roof.width * (-0.26 + fin * 0.06), top + 0.155, roof.depth * 0.15], scale: [0.012, 0.012, roof.depth * 0.21] })
    if (seed % 3 === 0) {
      roofs.push({ position: [roof.width * 0.27, top + 0.18, roof.depth * 0.24], scale: [0.012, 0.3, 0.012] })
      frames.push({ position: [roof.width * 0.27, top + 0.34, roof.depth * 0.24], scale: [0.035, 0.025, 0.035] })
    }

    group.add(instanceCityParts(windows, props.geometry, props.windowMaterial))
    group.add(instanceCityParts(frames, props.geometry, props.frameMaterial))
    group.add(instanceCityParts(roofs, props.geometry, props.rooftopMaterial))
  } else {
    const { forest, footprint } = cityConfig
    const trunks: CityPart[] = []
    const foliage: CityPart[] = []
    const placements = [[-0.28, -0.24], [0.25, -0.26], [-0.24, 0.26], [0.27, 0.23], [0.02, 0.02]] as const
    const groundTop = height / 2

    for (const [index, [offsetX, offsetZ]] of placements.entries()) {
      const variation = ((seed ^ Math.imul(index + 1, 2654435761)) >>> 0) % 100
      const treeHeight = forest.minHeight + (forest.maxHeight - forest.minHeight) * variation / 100
      const x = offsetX * footprint
      const z = offsetZ * footprint
      const radius = treeHeight * 0.22 * footprint
      const trunkHeight = treeHeight * 0.45
      const color = forest.foliage[(seed + index) % forest.foliage.length]!
      trunks.push({ position: [x, groundTop + trunkHeight / 2, z], scale: [0.045, trunkHeight, 0.045], color: forest.trunk })
      foliage.push({ position: [x, groundTop + treeHeight * 0.45, z], scale: [radius, treeHeight * 0.62, radius], color })
      foliage.push({ position: [x, groundTop + treeHeight * 0.75, z], scale: [radius * 0.77, treeHeight * 0.5, radius * 0.77], color })
    }

    group.add(instanceCityParts(trunks, props.geometry, props.forestMaterial))
    group.add(instanceCityParts(foliage, props.foliageGeometry, props.forestMaterial))
  }
  details.value = group
  disposeCityInstances(previous)
}

watch(() => [props.building.date, props.building.height, props.building.count, props.building.width, props.building.depth, props.building.profile], rebuildDetails, { immediate: true })
onUnmounted(() => disposeCityInstances(details.value))
</script>
