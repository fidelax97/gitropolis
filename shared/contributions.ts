export const contributionLevels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'] as const
export type ContributionLevel = typeof contributionLevels[number]

export interface ContributionDay {
  date: string
  count: number
  level: ContributionLevel
}

export interface Contributions {
  profile: { login: string; name: string | null; avatarUrl: string | null; url: string }
  period: { startDate: string; endDate: string; includesToday: boolean }
  days: ContributionDay[]
  total: number
  calendarTotal: number
  restrictedTotal: number | null
  visibility: string
  fetchedAt: string
  source: 'demo' | 'github'
}

export interface ApiErrorBody {
  error: { code: string; message: string; retryAfterSeconds?: number }
}
