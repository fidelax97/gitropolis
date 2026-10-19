<template>
  <div ref="viewport" class="city-viewport" :class="{ 'is-dragging': dragging }" role="group" aria-label="Interactive 3D contribution city. Drag to orbit, scroll or pinch to zoom. Use the date selector below for keyboard access." @pointerdown.capture="pointerDown" @pointermove.capture="pointerMove" @pointerup.capture="pointerUp" @pointercancel.capture="cancelPointer" @pointerleave="emit('hover', null)" @webglcontextlost.capture.prevent="rendererFailed">
    <TresCanvas v-if="supported && !failed" :clear-color="cityConfig.background" :dpr="[1, 1.5]" :alpha="false" :antialias="true" render-mode="on-demand" @error="rendererFailed">
      <TresPerspectiveCamera :args="[40, 1, 0.1, 100]" :position="cityConfig.camera.position" />
      <OrbitControls :target="cityConfig.camera.target" :enable-pan="false" :enable-damping="true" :min-distance="cityConfig.camera.minDistance" :max-distance="cityConfig.camera.maxDistance" :min-polar-angle="0.25" :max-polar-angle="Math.PI / 2.15" />
      <TresAmbientLight :intensity="cityConfig.lighting.ambient" />
      <TresDirectionalLight :position="cityConfig.lighting.position" :intensity="cityConfig.lighting.directional" color="#C6E6FF" />
      <TresDirectionalLight :position="[-8, 4, -5]" :intensity="0.7" color="#225985" />
      <CityLife :rows="Math.ceil(buildings.length / cityConfig.columns)" :active="pedestriansActive" />
      <CityBuilding v-for="building in buildings" :key="building.date" :building="building" :geometry="geometry" :material="selectedDate === building.date ? selectedMaterial : materials.get(building.color)!" :window-material="windowMaterial" :frame-material="frameMaterial" :rooftop-material="rooftopMaterial" :foliage-geometry="foliageGeometry" :forest-material="forestMaterial" :forest-ground-material="forestGroundMaterial" :selected="selectedDate === building.date" @hover="hover" @select="select" />
    </TresCanvas>
    <div v-else class="renderer-fallback" role="status">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M5 27V14h7v13m3 0V5h7v22m3 0v-9h4v9M2 27h29" /></svg>
      <h2>{{ failed ? 'The 3D view is unavailable' : 'Preparing your city…' }}</h2>
      <p v-if="failed">Your contribution data is still here. Use the date selector below to explore each day.</p>
    </div>
    <button v-if="supported && !failed" class="pedestrian-toggle" type="button" :disabled="reducedMotion" @click.stop="pedestriansPaused = !pedestriansPaused">
      {{ reducedMotion ? 'Reduced motion enabled' : pedestriansPaused ? 'Resume street activity' : 'Pause street activity' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, onMounted, onUnmounted, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { BoxGeometry, Color, ConeGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import CityBuilding from './CityBuilding.vue'
import CityLife from './CityLife.vue'
import type { CityBuilding as Building } from '../types/city'
import { cityConfig } from '../config/city'

defineProps<{ buildings: Building[]; selectedDate: string | null }>()
const emit = defineEmits<{ hover: [date: string | null]; select: [date: string] }>()
const supported = ref(false)
const failed = ref(false)
const dragging = ref(false)
const viewport = ref<HTMLDivElement | null>(null)
const pedestriansPaused = ref(false)
const reducedMotion = ref(true)
const tabVisible = ref(false)
const inView = ref(false)
const pedestriansActive = computed(() => !pedestriansPaused.value && !reducedMotion.value && tabVisible.value && inView.value)
let motionPreference: MediaQueryList | undefined
let visibilityObserver: IntersectionObserver | undefined
function updateMotionPreference() { reducedMotion.value = motionPreference?.matches ?? true }
function updateTabVisibility() { tabVisible.value = !document.hidden }
let moved = false
let origin: { x: number; y: number } | undefined
const pointers = new Set<number>()
const geometry = new BoxGeometry(1, 1, 1)
const foliageGeometry = new ConeGeometry(1, 1, 5)
const materials = new Map(cityConfig.palette.map(color => [color, new MeshStandardMaterial({ color: new Color(color).multiplyScalar(0.36), roughness: 0.55, metalness: 0.3 })]))
const selectedMaterial = new MeshStandardMaterial({ color: cityConfig.selection, roughness: 0.5, emissive: cityConfig.palette[4], emissiveIntensity: 0.12 })
const windowMaterial = new MeshBasicMaterial({ color: '#FFFFFF' })
const frameMaterial = new MeshBasicMaterial({ color: cityConfig.architecture.frame, transparent: true, opacity: 0.6, depthWrite: false })
const rooftopMaterial = new MeshStandardMaterial({ color: cityConfig.architecture.rooftop, roughness: 0.8, metalness: 0.2 })
const forestMaterial = new MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, flatShading: true })
const forestGroundMaterial = new MeshStandardMaterial({ color: cityConfig.forest.ground, roughness: 1 })

function rendererFailed() { failed.value = true; emit('hover', null) }
function pointerDown(event: PointerEvent) {
  if (event.target instanceof Element && event.target.closest('button')) return
  pointers.add(event.pointerId)
  if (pointers.size === 1) { origin = { x: event.clientX, y: event.clientY }; moved = false }
  else moved = true
}
function pointerMove(event: PointerEvent) {
  if (origin && pointers.size > 0 && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) moved = true
  dragging.value = moved && pointers.size > 0
  if (dragging.value) emit('hover', null)
}
function pointerUp(event: PointerEvent) { pointers.delete(event.pointerId); dragging.value = false; if (!pointers.size) origin = undefined }
function cancelPointer(event: PointerEvent) { moved = true; pointerUp(event) }
function hover(date: string | null) { if (!dragging.value) emit('hover', date) }
function select(date: string) { if (!moved) emit('select', date) }

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference()
  updateTabVisibility()
  motionPreference.addEventListener('change', updateMotionPreference)
  document.addEventListener('visibilitychange', updateTabVisibility)
  if ('IntersectionObserver' in window && viewport.value) {
    visibilityObserver = new IntersectionObserver(entries => { inView.value = entries.some(entry => entry.isIntersecting) })
    visibilityObserver.observe(viewport.value)
  } else inView.value = true
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('pointercancel', cancelPointer)
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    supported.value = Boolean(context)
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    if (!context) rendererFailed()
  } catch { rendererFailed() }
})
onErrorCaptured(() => { rendererFailed(); return false })
onUnmounted(() => {
  motionPreference?.removeEventListener('change', updateMotionPreference)
  document.removeEventListener('visibilitychange', updateTabVisibility)
  visibilityObserver?.disconnect()
  window.removeEventListener('pointerup', pointerUp)
  window.removeEventListener('pointercancel', cancelPointer)
  geometry.dispose()
  foliageGeometry.dispose()
  for (const material of materials.values()) material.dispose()
  selectedMaterial.dispose()
  windowMaterial.dispose()
  frameMaterial.dispose()
  rooftopMaterial.dispose()
  forestMaterial.dispose()
  forestGroundMaterial.dispose()
  pointers.clear()
})
</script>
