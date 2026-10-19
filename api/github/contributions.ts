import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Contributions, ApiErrorBody } from '../../shared/contributions'
import { normalizeUsername } from '../../shared/username'
import { getDateRange } from '../../shared/period'
import { fetchGithubContributions } from '../../server/github'
import { GithubError } from '../../server/errors'

export type ContributionRequest = IncomingMessage & { query: Record<string, string | string[] | undefined> }
export type ContributionResponse = ServerResponse & {
  status(code: number): ContributionResponse
  json(body: unknown): ContributionResponse
}

export interface HandlerOptions {
  token?: () => string | undefined
  verified?: () => boolean
  now?: () => Date
  fetcher?: typeof fetch
}

export function createContributionsHandler(options: HandlerOptions = {}) {
  const token = options.token ?? (() => process.env.GITHUB_TOKEN)
  const verified = options.verified ?? (() => process.env.GITHUB_VISIBILITY_VERIFIED === 'true')
  const clock = options.now ?? (() => new Date())
  const cache = new Map<string, { data: Contributions; expiresAt: number }>()
  const pending = new Map<string, Promise<Contributions>>()
  return async (request: ContributionRequest, response: ContributionResponse): Promise<void> => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET')
        throw new GithubError(405, 'METHOD_NOT_ALLOWED', 'Use GET to request a contribution calendar.')
      }
      let username: string
      try { username = normalizeUsername(request.query.username) }
      catch { throw new GithubError(400, 'INVALID_USERNAME', 'Enter a valid GitHub username, without a profile URL or @ prefix.') }
      const secret = token()
      if (!secret) throw new GithubError(503, 'LIVE_UNAVAILABLE', 'Live GitHub access is not configured. You can explore the demo city.')
      if (!verified()) throw new GithubError(503, 'LIVE_NOT_VERIFIED', 'Live GitHub access is not available yet. You can explore the demo city.')
      const now = clock()
      const range = getDateRange(now)
      const key = `${username}:${range.startDate}:${range.endDate}`
      for (const [cacheKey, entry] of cache) if (entry.expiresAt <= now.getTime()) cache.delete(cacheKey)
      const hit = cache.get(key)
      if (hit) { response.status(200).json(hit.data); return }
      let task = pending.get(key)
      if (!task) {
        task = fetchGithubContributions(username, now, secret, options.fetcher).then(data => {
          if (cache.size >= 100) cache.delete(cache.keys().next().value!)
          cache.set(key, { data, expiresAt: clock().getTime() + 60_000 })
          return data
        }).finally(() => pending.delete(key))
        pending.set(key, task)
      }
      response.status(200).json(await task)
    } catch (error) {
      const failure = error instanceof GithubError ? error : new GithubError(502, 'UPSTREAM_ERROR', 'The contribution service is temporarily unavailable. Please try again.')
      const body: ApiErrorBody = { error: { code: failure.code, message: failure.message } }
      if (failure.retryAfterSeconds) {
        body.error.retryAfterSeconds = failure.retryAfterSeconds
        response.setHeader('Retry-After', failure.retryAfterSeconds)
      }
      response.status(failure.status).json(body)
    }
  }
}

export default createContributionsHandler()
