<template>
  <div class="profile-summary">
    <div class="profile-identity">
      <img v-if="data.profile.avatarUrl" :src="data.profile.avatarUrl" alt="" width="38" height="38" referrerpolicy="no-referrer" />
      <div v-else class="profile-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20V10h5v10m2 0V4h5v16m2 0v-7h3v7M2 20h21" /></svg></div>
      <div>
        <div class="profile-name"><strong>{{ data.profile.name || data.profile.login }}</strong><span v-if="data.source === 'demo'" class="demo-badge">Sample data</span></div>
        <a v-if="data.source === 'github'" :href="data.profile.url" target="_blank" rel="noopener noreferrer">@{{ data.profile.login }} <span class="sr-only">on GitHub, opens in a new tab</span></a>
        <span v-else class="profile-caption">A little inspiration for your skyline</span>
      </div>
    </div>
    <div class="period-summary">
      <strong>{{ data.total.toLocaleString() }} contributions</strong>
      <span>{{ formatDate(data.period.startDate) }} – {{ formatDate(data.period.endDate) }} · UTC</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Contributions } from '../../shared/contributions'

defineProps<{ data: Contributions }>()
function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}
</script>
