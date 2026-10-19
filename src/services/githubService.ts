import type { ApiErrorBody, Contributions } from '../../shared/contributions'

export class ContributionRequestError extends Error {
  constructor(message: string, public code: string, public retryAfterSeconds?: number) {
    super(message)
    this.name = 'ContributionRequestError'
  }
}

export async function fetchContributions(username: string, signal: AbortSignal): Promise<Contributions> {
  if (import.meta.env.VITE_DATA_MODE !== 'live') {
    throw new ContributionRequestError('Live cities aren’t available in this demo. Explore the sample city below.', 'DEMO_MODE')
  }
  let response: Response
  try {
    response = await fetch(`/api/github/contributions?${new URLSearchParams({ username })}`, { signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new ContributionRequestError('The city service could not be reached. Check your connection and try again.', 'NETWORK_ERROR')
  }
  let payload: unknown
  try { payload = await response.json() }
  catch { throw new ContributionRequestError('The city service returned an unreadable response. Please try again.', 'INVALID_RESPONSE') }
  if (!response.ok) {
    const failure = payload as Partial<ApiErrorBody>
    const error = failure?.error
    const delay = error?.retryAfterSeconds
    throw new ContributionRequestError(
      typeof error?.message === 'string' ? error.message : 'The city service is unavailable. Please try again.',
      typeof error?.code === 'string' ? error.code : 'SERVICE_ERROR',
      typeof delay === 'number' && Number.isFinite(delay) && delay > 0 ? delay : undefined,
    )
  }
  const data = payload as Contributions
  if (!data || data.source !== 'github' || !Array.isArray(data.days) || data.days.length !== 30 || !data.profile || !data.period) {
    throw new ContributionRequestError('The city service returned an incomplete calendar. Please try again.', 'INVALID_RESPONSE')
  }
  return data
}
