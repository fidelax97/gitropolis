<template>
  <form class="search-form" novalidate @submit.prevent="emit('generate', username)">
    <label for="github-username">Build a city from a GitHub username</label>
    <div class="search-row">
      <div class="username-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input id="github-username" v-model="username" name="username" type="text" placeholder="GitHub username" autocomplete="off" autocapitalize="none" :spellcheck="false" maxlength="80" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'search-error' : 'search-help'" />
      </div>
      <button class="button-primary" type="submit" :disabled="retrySeconds > 0" :aria-busy="loading">
        {{ retrySeconds > 0 ? `Retry in ${retrySeconds}s` : loading ? 'Generating…' : 'Generate city' }}
        <svg v-if="!loading && retrySeconds === 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
      </button>
    </div>
    <div class="search-footnote">
      <p id="search-help">Publicly visible activity. No GitHub sign-in needed.</p>
      <button class="text-button" type="button" @click="emit('demo')">Explore demo</button>
    </div>
    <p v-if="error" id="search-error" class="error-message" role="alert">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ loading: boolean; error: string; retrySeconds: number }>()
const emit = defineEmits<{ generate: [username: string]; demo: [] }>()
const username = ref('')
</script>
