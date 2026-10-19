import { contributionLevels, type ContributionDay, type ContributionLevel, type Contributions } from '../shared/contributions'
import { getDateRange } from '../shared/period'
import { normalizeUsername } from '../shared/username'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid GitHub response')
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid contribution count')
  return value
}

export function normalizeContributions(input: unknown, now: Date): Contributions {
  const user = record(input)
  const login = normalizeUsername(user.login)
  const collection = record(user.contributionsCollection)
  const calendar = record(collection.contributionCalendar)
  const range = getDateRange(now)
  const expected = new Set(range.dates)
  const byDate = new Map<string, ContributionDay>()
  if (!Array.isArray(calendar.weeks)) throw new Error('Missing calendar weeks')
  for (const week of calendar.weeks) {
    const days = record(week).contributionDays
    if (!Array.isArray(days)) throw new Error('Missing calendar days')
    for (const entry of days) {
      const day = record(entry)
      if (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error('Invalid contribution date')
      const parsed = new Date(`${day.date}T00:00:00Z`)
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day.date) throw new Error('Invalid contribution date')
      if (!expected.has(day.date)) continue
      if (byDate.has(day.date)) throw new Error('Duplicate contribution date')
      if (!contributionLevels.includes(day.contributionLevel as ContributionLevel)) throw new Error('Invalid contribution level')
      byDate.set(day.date, { date: day.date, count: count(day.contributionCount), level: day.contributionLevel as ContributionLevel })
    }
  }
  if (byDate.size !== range.dates.length) throw new Error('Incomplete contribution calendar')
  const days = range.dates.map(date => byDate.get(date)!)
  const calendarTotal = count(calendar.totalContributions)
  const restrictedTotal = count(collection.restrictedContributionsCount)
  if (typeof collection.hasAnyRestrictedContributions !== 'boolean') throw new Error('Missing visibility information')
  const avatar = typeof user.avatarUrl === 'string' ? user.avatarUrl : ''
  let avatarUrl: string | null = null
  try {
    const url = new URL(avatar)
    if (url.protocol === 'https:' && url.hostname === 'avatars.githubusercontent.com') avatarUrl = url.href
  } catch { /* An unavailable avatar does not invalidate the contribution calendar. */ }
  return {
    profile: { login, name: typeof user.name === 'string' ? user.name : null, avatarUrl, url: `https://github.com/${login}` },
    period: { startDate: range.startDate, endDate: range.endDate, includesToday: true },
    days,
    total: days.reduce((sum, day) => sum + day.count, 0),
    calendarTotal,
    restrictedTotal,
    visibility: 'Counts reflect activity GitHub makes visible to this service. Private activity may be hidden or unavailable. Restricted totals are not added to daily counts.',
    fetchedAt: now.toISOString(),
    source: 'github',
  }
}
