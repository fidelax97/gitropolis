import type { Contributions, ContributionLevel } from '../../shared/contributions'
import { getDateRange } from '../../shared/period'

const sampleCounts = [0, 3, 8, 2, 16, 5, 1, 0, 12, 22, 6, 4, 9, 35, 14, 0, 3, 7, 18, 50, 11, 5, 2, 0, 28, 8, 4, 19, 7, 12]

export function createDemoContributions(now = new Date()): Contributions {
  const range = getDateRange(now)
  const days = range.dates.map((date, i) => {
    const count = sampleCounts[i]!
    const level: ContributionLevel = count === 0 ? 'NONE' : count <= 5 ? 'FIRST_QUARTILE' : count <= 12 ? 'SECOND_QUARTILE' : count <= 25 ? 'THIRD_QUARTILE' : 'FOURTH_QUARTILE'
    return { date, count, level }
  })
  const total = days.reduce((sum, day) => sum + day.count, 0)
  return {
    profile: { login: 'demo', name: 'Demo city', avatarUrl: null, url: 'https://github.com' },
    period: { startDate: range.startDate, endDate: range.endDate, includesToday: true },
    days, total, calendarTotal: total, restrictedTotal: null,
    visibility: 'This city uses illustrative sample data, not a real GitHub account.',
    fetchedAt: now.toISOString(), source: 'demo',
  }
}
