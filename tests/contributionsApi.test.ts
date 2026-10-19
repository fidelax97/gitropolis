import { describe, expect, it, vi } from 'vitest'
import type { ContributionRequest as VercelRequest, ContributionResponse as VercelResponse } from '../api/github/contributions'
import { createContributionsHandler } from '../api/github/contributions'
import { fixedNow, githubUser } from './fixtures'

function response(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function setup(fetcher: typeof fetch = vi.fn(async () => response({ data: { user: githubUser() } })), now = () => fixedNow) {
  const handler = createContributionsHandler({ token: () => 'test-token-never-return', verified: () => true, fetcher, now })
  async function request(username: unknown = 'octocat', method = 'GET') {
    const result = { status: 200, body: undefined as any, headers: {} as Record<string, string | number | readonly string[]> }
    const res = {
      status(code: number) { result.status = code; return res },
      json(body: unknown) { result.body = body; return res },
      setHeader(name: string, value: string | number | readonly string[]) { result.headers[name.toLowerCase()] = value; return res },
    }
    await handler({ method, query: { username } } as VercelRequest, res as unknown as VercelResponse)
    return result
  }
  return { request, handler }
}

describe('contributions endpoint', () => {
  it('returns normalized results without disclosing the token', async () => {
    const result = await setup().request(' OctoCat ')
    expect(result.status).toBe(200)
    expect(result.body.total).toBe(60)
    expect(result.body.restrictedTotal).toBe(12)
    expect(JSON.stringify(result.body)).not.toContain('test-token')
    expect(result.headers['cache-control']).toBe('no-store')
  })
  it.each([{ input: undefined }, { input: '' }, { input: 'a--b' }, { input: ['cat', 'dog'] }, { input: 'https://github.com/cat' }])('rejects invalid input before upstream calls: %j', async ({ input: username }) => {
    const result = await setup().request(username === undefined ? null : username)
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('INVALID_USERNAME')
  })
  it('rejects non-GET methods', async () => {
    const result = await setup().request('octocat', 'POST')
    expect(result.status).toBe(405)
    expect(result.headers.allow).toBe('GET')
  })
  it.each([
    [null, 200, 404, 'USER_NOT_FOUND'],
    [{ errors: [{ type: 'RATE_LIMITED', message: 'rate limit exceeded' }] }, 200, 429, 'RATE_LIMITED'],
    [{ errors: [{ type: 'FORBIDDEN', message: 'secret upstream details' }] }, 200, 503, 'UPSTREAM_AUTH'],
    [{ data: { user: githubUser() }, errors: [{ message: 'partial failure' }] }, 200, 502, 'UPSTREAM_ERROR'],
    [{ message: 'bad credentials' }, 401, 503, 'UPSTREAM_AUTH'],
    [{ message: 'secret backend' }, 500, 502, 'UPSTREAM_ERROR'],
  ])('maps upstream failure to %s / %s', async (body, upstreamStatus, expectedStatus, code) => {
    const fetcher = vi.fn(async () => response(body === null ? { data: { user: null } } : body, upstreamStatus))
    const result = await setup(fetcher).request()
    expect(result.status).toBe(expectedStatus)
    expect(result.body.error.code).toBe(code)
    expect(JSON.stringify(result.body)).not.toMatch(/secret|credentials/)
  })
  it('honors retry-after on secondary rate limits', async () => {
    const result = await setup(vi.fn(async () => response({ message: 'secondary rate limit' }, 403, { 'retry-after': '120' }))).request()
    expect(result.status).toBe(429)
    expect(result.body.error.retryAfterSeconds).toBe(120)
    expect(result.headers['retry-after']).toBe(120)
  })
  it('uses the primary reset time when retry-after is absent', async () => {
    const reset = Math.floor(fixedNow.getTime() / 1000) + 90
    const result = await setup(vi.fn(async () => response({ errors: [{ type: 'RATE_LIMITED' }] }, 200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }))).request()
    expect(result.body.error.retryAfterSeconds).toBe(90)
  })
  it('rejects malformed JSON and incomplete calendars', async () => {
    const malformed = await setup(vi.fn(async () => new Response('not json'))).request()
    expect(malformed.status).toBe(502)
    const user = githubUser()
    user.contributionsCollection.contributionCalendar.weeks[0]!.contributionDays.pop()
    const incomplete = await setup(vi.fn(async () => response({ data: { user } }))).request()
    expect(incomplete.status).toBe(502)
  })
  it('maps network failure and timeout to safe errors', async () => {
    const network = await setup(vi.fn(async () => { throw new TypeError('secret network detail') })).request()
    expect(network.status).toBe(502)
    const timedOut = await setup(vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError') })).request()
    expect(timedOut.status).toBe(504)
  })
  it('does not publish live data without an explicit visibility verification flag', async () => {
    const handler = createContributionsHandler({ token: () => 'test', verified: () => false })
    let code = 0
    const res = { setHeader() {}, status(value: number) { code = value; return res }, json() {} }
    await handler({ method: 'GET', query: { username: 'octocat' } } as VercelRequest, res as unknown as VercelResponse)
    expect(code).toBe(503)
  })
  it('handles a missing server token safely', async () => {
    const handler = createContributionsHandler({ token: () => undefined, verified: () => true })
    let code = 0
    const res = { setHeader() {}, status(value: number) { code = value; return res }, json() {} }
    await handler({ method: 'GET', query: { username: 'octocat' } } as VercelRequest, res as unknown as VercelResponse)
    expect(code).toBe(503)
  })
  it('coalesces identical concurrent requests and caches successful responses', async () => {
    const fetcher = vi.fn(async () => response({ data: { user: githubUser() } }))
    const api = setup(fetcher)
    const results = await Promise.all([api.request('OctoCat'), api.request('octocat')])
    expect(results.map(r => r.status)).toEqual([200, 200])
    await api.request()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('expires successes after sixty seconds', async () => {
    const fetcher = vi.fn(async () => response({ data: { user: githubUser() } }))
    let now = fixedNow
    const api = setup(fetcher, () => now)
    await api.request()
    now = new Date(fixedNow.getTime() + 60_001)
    await api.request()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('does not cache failures', async () => {
    const fetcher = vi.fn(async () => response({}, 500))
    const api = setup(fetcher)
    await api.request()
    await api.request()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('bounds successful cache entries to one hundred', async () => {
    const fetcher = vi.fn(async () => response({ data: { user: githubUser() } }))
    const api = setup(fetcher)
    for (let i = 0; i < 101; i++) await api.request(`user${i}`)
    await api.request('user0')
    expect(fetcher).toHaveBeenCalledTimes(102)
  })
  it('uses a new period key after UTC midnight', async () => {
    let now = new Date('2026-03-01T23:59:59Z')
    const fetcher = vi.fn(async () => {
      const user = githubUser()
      if (now.getUTCDate() === 2) {
        const days = user.contributionsCollection.contributionCalendar.weeks[0]!.contributionDays
        days.shift()
        days.push({ date: '2026-03-02', contributionCount: 2, contributionLevel: 'FIRST_QUARTILE' })
      }
      return response({ data: { user } })
    })
    const api = setup(fetcher, () => now)
    expect((await api.request()).status).toBe(200)
    now = new Date('2026-03-02T00:00:01Z')
    expect((await api.request()).body.period.endDate).toBe('2026-03-02')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
