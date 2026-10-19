<template>
  <CityEnvironment ref="environment" :rows="rows" :initial-phase="initialPhase" />
  <CityPedestrians ref="pedestrians" :rows="rows" :traffic="traffic" />
  <CityCars ref="cars" :rows="rows" :traffic="traffic" />
</template>

<script setup lang="ts">
import { onUnmounted, shallowRef } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import CityEnvironment from './CityEnvironment.vue'
import CityPedestrians from './CityPedestrians.vue'
import CityCars from './CityCars.vue'
import { createCityTraffic } from '../utils/cityTraffic'

const props = defineProps<{ rows: number; active: boolean }>()
const environment = shallowRef<InstanceType<typeof CityEnvironment>>()
const pedestrians = shallowRef<InstanceType<typeof CityPedestrians>>()
const cars = shallowRef<InstanceType<typeof CityCars>>()
const traffic = createCityTraffic()
const initialPhase = traffic.phaseAt(0)
const { renderer } = useTresContext()
const { onBeforeRender } = useLoop()
let time = 0
const { off } = onBeforeRender(({ delta }) => {
  if (!props.active) return
  const step = Math.min(delta, 0.05)
  pedestrians.value?.advance(step, time)
  cars.value?.advance(step, time)
  time += step
  environment.value?.updateSignals(traffic.phaseAt(time))
  renderer.invalidate()
})
onUnmounted(off)
</script>
