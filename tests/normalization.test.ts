import { describe, expect, it } from 'vitest'
import { getDateRange } from '../shared/period'
import { normalizeContributions } from '../server/normalizeContributions'
import { fixedNow, githubUser } from './fixtures'

describe('UTC period', () => {
  it.each([
    ['2026-03-01T00:00:00Z', '2026-01-31', '2026-03-01'],
    ['2024-03-01T23:59:59Z', '2024-02-01', '2024-03-01'],
    ['2026-01-01T00:00:00Z', '2025-12-03', '2026-01-01'],
    ['2026-10-19T00:30:00+08:00', '2026-09-19', '2026-10-18'],
  ])('includes today and the preceding 29 UTC dates: %s', (date, start, end) => {
    const range = getDateRange(new Date(date))
    expect(range.startDate).toBe(start)
    expect(range.endDate).toBe(end)
    expect(range.dates).toHaveLength(30)
    expect(range.from).toBe(`${start}T00:00:00.000Z`)
  })
})

describe('calendar normalization', () => {
  it('sorts calendar days and keeps restricted aggregates separate', () => {
    const user = githubUser()
    user.contributionsCollection.contributionCalendar.weeks[0]!.contributionDays.reverse()
    const result = normalizeContributions(user, fixedNow)
    expect(result.days).toHaveLength(30)
    expect(result.days[0]).toEqual({ date: '2026-01-31', count: 2, level: 'FIRST_QUARTILE' })
    expect(result.days[29]?.date).toBe('2026-03-01')
    expect(result.total).toBe(60)
    expect(result.calendarTotal).toBe(60)
    expect(result.restrictedTotal).toBe(12)
    expect(result.period.includesToday).toBe(true)
  })
  it('keeps explicit zero days without claiming private activity is absent', () => {
    const user = githubUser(0)
    user.contributionsCollection.restrictedContributionsCount = 0
    user.contributionsCollection.hasAnyRestrictedContributions = false
    const result = normalizeContributions(user, fixedNow)
    expect(result.total).toBe(0)
    expect(result.days).toHaveLength(30)
    expect(result.days.every(day => day.count === 0)).toBe(true)
    expect(result.visibility).toMatch(/hidden|unavailable/i)
  })
  it('filters padded dates without changing the displayed total', () => {
    const user = githubUser()
    user.contributionsCollection.contributionCalendar.weeks[0]!.contributionDays.push({ date: '2026-03-02', contributionCount: 900, contributionLevel: 'FOURTH_QUARTILE' })
    expect(normalizeContributions(user, fixedNow).total).toBe(60)
  })
  it.each(['missing', 'duplicate', 'negative', 'fractional', 'level', 'invalid date', 'missing restricted'])('rejects malformed upstream data: %s', kind => {
    const user = githubUser()
    const days = user.contributionsCollection.contributionCalendar.weeks[0]!.contributionDays
    if (kind === 'missing') days.pop()
    if (kind === 'duplicate') days.push({ ...days[0]! })
    if (kind === 'negative') days[0]!.contributionCount = -1
    if (kind === 'fractional') days[0]!.contributionCount = 1.5
    if (kind === 'level') days[0]!.contributionLevel = 'EXTREME'
    if (kind === 'invalid date') days[0]!.date = '2026-02-30'
    if (kind === 'missing restricted') Reflect.deleteProperty(user.contributionsCollection, 'restrictedContributionsCount')
    expect(() => normalizeContributions(user, fixedNow)).toThrow()
  })
})
