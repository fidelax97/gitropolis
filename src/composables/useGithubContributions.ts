import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { normalizeUsername } from '../../shared/username'
import { createDemoContributions } from '../mocks/contributions'
import { ContributionRequestError, fetchContributions } from '../services/githubService'

export function useGithubContributions(loader = fetchContributions) {
  const data = shallowRef(createDemoContributions())
  const loading = ref(false)
  const error = ref('')
  const searchedUsername = ref('')
  const retryAt = ref(0)
  const tick = ref(Date.now())
  const retrySeconds = computed(() => Math.max(0, Math.ceil((retryAt.value - tick.value) / 1000)))
  let controller: AbortController | undefined
  let requestId = 0
  let timer: ReturnType<typeof setInterval> | undefined

  function stopRequest() {
    requestId++
    controller?.abort()
    loading.value = false
  }

  function stopTimer() {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  async function generate(input: string) {
    if (retrySeconds.value > 0) return
    stopRequest()
    error.value = ''
    let username: string
    try { username = normalizeUsername(input) }
    catch (failure) {
      error.value = failure instanceof Error ? failure.message : 'Enter a GitHub username.'
      return
    }
    searchedUsername.value = username
    controller = new AbortController()
    const signal = controller.signal
    const id = requestId
    loading.value = true
    try {
      const result = await loader(username, signal)
      if (id === requestId && !signal.aborted) data.value = result
    } catch (failure) {
      if (id !== requestId || signal.aborted) return
      error.value = failure instanceof Error ? failure.message : 'The city could not be generated. Please try again.'
      if (failure instanceof ContributionRequestError && failure.retryAfterSeconds) {
        stopTimer()
        tick.value = Date.now()
        retryAt.value = tick.value + failure.retryAfterSeconds * 1000
        timer = setInterval(() => {
          tick.value = Date.now()
          if (tick.value >= retryAt.value) stopTimer()
        }, 1000)
      }
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function showDemo() {
    stopRequest()
    error.value = ''
    searchedUsername.value = ''
    data.value = createDemoContributions()
  }

  onScopeDispose(() => { stopRequest(); stopTimer() })
  return { data, loading, error, searchedUsername, retrySeconds, generate, showDemo }
}
