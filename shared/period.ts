export function getDateRange(now: Date) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const dates = Array.from({ length: 30 }, (_, i) => new Date(midnight - (29 - i) * 86_400_000).toISOString().slice(0, 10))
  const startDate = dates[0]!
  const endDate = dates[29]!
  return { startDate, endDate, from: `${startDate}T00:00:00.000Z`, to: now.toISOString(), dates }
}
