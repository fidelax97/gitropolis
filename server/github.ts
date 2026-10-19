import type { Contributions } from '../shared/contributions'
import { getDateRange } from '../shared/period'
import { normalizeContributions } from './normalizeContributions'
import { GithubError } from './errors'

const query = `query Gitropolis($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    login name avatarUrl url
    contributionsCollection(from: $from, to: $to) {
      restrictedContributionsCount hasAnyRestrictedContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
  rateLimit { remaining resetAt }
}`

function retryDelay(response: Response, now: Date): number {
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds))
    const date = Date.parse(retryAfter)
    if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - now.getTime()) / 1000))
  }
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  if (reset > 0) return Math.max(1, Math.ceil(reset - now.getTime() / 1000))
  return 60
}

export async function fetchGithubContributions(username: string, now: Date, token: string, fetcher: typeof fetch = fetch): Promise<Contributions> {
  const range = getDateRange(now)
  const signal = AbortSignal.timeout(10_000)
  try {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST', signal,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Gitropolis' },
      body: JSON.stringify({ query, variables: { login: username, from: range.from, to: range.to } }),
    })
    const payload: any = await response.json()
    const errors: { type?: string; message?: string }[] = Array.isArray(payload?.errors) ? payload.errors : []
    const rateLimited = response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' && !response.ok
      || errors.some(error => error?.type === 'RATE_LIMITED' || /rate limit/i.test(error?.message ?? ''))
      || response.status === 403 && (response.headers.has('retry-after') || /rate limit/i.test(payload?.message ?? ''))
    if (rateLimited) throw new GithubError(429, 'RATE_LIMITED', 'GitHub is limiting requests. Please wait before trying again.', retryDelay(response, now))
    if (response.status === 401 || response.status === 403 || errors.some(error => error?.type === 'FORBIDDEN' || error?.type === 'INSUFFICIENT_SCOPES')) {
      throw new GithubError(503, 'UPSTREAM_AUTH', 'Live GitHub access is temporarily unavailable. You can explore the demo city.')
    }
    if (errors.length > 0 && errors.every(error => error?.type === 'NOT_FOUND') && payload?.data?.user === null) {
      throw new GithubError(404, 'USER_NOT_FOUND', 'That GitHub user could not be found. Check the username and try again.')
    }
    if (!response.ok || errors.length > 0) throw new GithubError(502, 'UPSTREAM_ERROR', 'GitHub could not return a complete contribution calendar. Please try again.')
    if (payload?.data?.user === null) throw new GithubError(404, 'USER_NOT_FOUND', 'That GitHub user could not be found. Check the username and try again.')
    return normalizeContributions(payload?.data?.user, now)
  } catch (error) {
    if (error instanceof GithubError) throw error
    if (signal.aborted || error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
      throw new GithubError(504, 'UPSTREAM_TIMEOUT', 'GitHub took too long to respond. Please try again.')
    }
    throw new GithubError(502, 'UPSTREAM_ERROR', 'GitHub could not return a complete contribution calendar. Please try again.')
  }
}
