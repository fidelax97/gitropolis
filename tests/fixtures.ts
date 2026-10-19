export const fixedNow = new Date('2026-03-01T12:34:00Z')

export function githubUser(count = 2) {
  const days = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 31 + i)).toISOString().slice(0, 10),
    contributionCount: count,
    contributionLevel: count === 0 ? 'NONE' : 'FIRST_QUARTILE',
  }))
  return {
    login: 'octocat', name: 'The Octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/583231', url: 'https://github.com/octocat',
    contributionsCollection: {
      restrictedContributionsCount: 12,
      hasAnyRestrictedContributions: true,
      contributionCalendar: { totalContributions: count * 30, weeks: [{ contributionDays: days }] },
    },
  }
}
