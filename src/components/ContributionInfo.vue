<template>
  <section class="contribution-info" aria-labelledby="day-details-title">
    <div class="day-details">
      <span class="detail-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 2v6m8-6v6M4 11h16" /></svg></span>
      <div>
        <h2 id="day-details-title">{{ day ? formatDate(day.date) : 'Every plot is a day' }}</h2>
        <p v-if="day"><strong>{{ day.count.toLocaleString() }} {{ day.count === 1 ? 'contribution' : 'contributions' }}</strong><span v-if="day.date === data.period.endDate"> · Today, in progress</span><span v-if="pinned"> · Pinned</span></p>
        <p v-else>Hover to explore. Select a plot to keep its details.</p>
      </div>
    </div>
    <div class="date-controls">
      <label for="selected-date" class="sr-only">Select a contribution date</label>
      <select id="selected-date" :value="pinnedDate || ''" @change="emit('select', ($event.target as HTMLSelectElement).value || null)">
        <option value="">Choose a date</option>
        <option v-for="entry in data.days" :key="entry.date" :value="entry.date">{{ formatDate(entry.date) }} · {{ entry.count }} contributions</option>
      </select>
      <button class="text-button clear-selection" type="button" :disabled="!day && !pinnedDate" @click="emit('select', null)">Clear<span class="sr-only"> selection</span></button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ContributionDay, Contributions } from '../../shared/contributions'

defineProps<{ data: Contributions; day: ContributionDay | undefined; pinned: boolean; pinnedDate: string | null }>()
const emit = defineEmits<{ select: [date: string | null] }>()
function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}
</script>
