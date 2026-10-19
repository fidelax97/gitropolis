<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="Gitropolis home">
        <svg class="brand-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 27V14h6v13m3 0V5h6v22m3 0V11h6v16M2 27h28" /></svg>
        Gitropolis<span class="brand-dot">.</span>
      </a>
      <span class="header-note">A skyline of your own</span>
    </header>

    <main id="main-content">
      <section class="intro" aria-labelledby="page-title">
        <h1 id="page-title">Small contributions.<br /><span>A city of possibilities.</span></h1>
        <p class="tagline">Your GitHub contributions, reimagined as a living 3D city.</p>
        <UsernameSearch :loading="loading" :error="error" :retry-seconds="retrySeconds" @generate="generate" @demo="showDemo" />
      </section>

      <section class="city-section" aria-labelledby="city-title" :aria-busy="loading">
        <h2 id="city-title" class="sr-only">{{ data.source === 'demo' ? 'Demo contribution city' : `${data.profile.login}’s contribution city` }}</h2>
        <ProfileSummary :data="data" />
        <div class="scene-frame">
          <div class="scene-meta" aria-hidden="true"><span class="scene-status-dot"></span>{{ data.source === 'demo' ? 'Demo district' : `@${data.profile.login}’s district` }}<span class="scene-meta-divider">/</span>30 days</div>
          <CityScene :buildings="buildings" :selected-date="displayedDate" @hover="hoveredDate = $event" @select="selectDate" />
          <p v-if="loading" class="loading-notice" role="status">Generating @{{ searchedUsername }}’s city…<span>Showing {{ data.source === 'demo' ? 'the demo' : `@${data.profile.login}` }} while it loads.</span></p>
          <div class="scene-instructions" aria-hidden="true">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m8 5-4 4 4 4m8-8 4 4-4 4M4 9h16M12 14v7m-3-3 3 3 3-3" /></svg>Drag to orbit</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 6v4" /></svg>Scroll or pinch to zoom</span>
          </div>
        </div>
        <ContributionInfo :data="data" :day="selectedDay" :pinned="Boolean(pinnedDate && displayedDate === pinnedDate)" :pinned-date="pinnedDate" @select="selectDate" />
        <p v-if="data.total === 0" class="zero-message" role="status">No visible contributions in this period. Each forest plot represents a zero-contribution day.</p>
        <div class="data-notes">
          <p>{{ data.visibility }}<template v-if="data.source === 'github' && data.restrictedTotal !== null && data.restrictedTotal > 0"> GitHub reports {{ data.restrictedTotal.toLocaleString() }} restricted contributions for this period; this aggregate is shown separately and is never added to building counts.</template></p>
          <p>Height follows daily activity, with a cap at 50 contributions. Today is still in progress.</p>
        </div>
      </section>
    </main>

    <footer class="site-footer"><span>Built one contribution at a time.</span><p>Contributions include eligible commits, issues, pull requests and reviews — not just commits. <a href="https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference" target="_blank" rel="noopener noreferrer">How GitHub counts activity<span class="sr-only">, opens in a new tab</span></a></p></footer>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import UsernameSearch from './components/UsernameSearch.vue'
import ProfileSummary from './components/ProfileSummary.vue'
import ContributionInfo from './components/ContributionInfo.vue'
import { useGithubContributions } from './composables/useGithubContributions'
import { mapContributions } from './utils/contributionMapper'
import { cityConfig } from './config/city'

const CityScene = defineAsyncComponent(() => import('./components/CityScene.vue'))
const { data, loading, error, searchedUsername, retrySeconds, generate, showDemo } = useGithubContributions()
const hoveredDate = ref<string | null>(null)
const pinnedDate = ref<string | null>(null)
const displayedDate = computed(() => hoveredDate.value ?? pinnedDate.value)
const selectedDay = computed(() => data.value.days.find(day => day.date === displayedDate.value))
const buildings = computed(() => mapContributions(data.value.days))
function selectDate(date: string | null) { hoveredDate.value = null; pinnedDate.value = date }
function onKeydown(event: KeyboardEvent) { if (event.key === 'Escape') selectDate(null) }
watch(data, () => selectDate(null))
onMounted(() => {
  document.documentElement.style.setProperty('--background', cityConfig.background)
  document.documentElement.style.setProperty('--ground', cityConfig.ground)
  document.documentElement.style.setProperty('--accent', cityConfig.palette[4]!)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
