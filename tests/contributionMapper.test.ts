import { describe, expect, it } from 'vitest'
import { contributionHeight, mapContributions } from '../src/utils/contributionMapper'
import type { ContributionDay } from '../shared/contributions'

describe('city mapping', () => {
  it('renders zero as a small foundation', () => expect(contributionHeight(0)).toBe(0.08))
  it('grows monotonically and saturates at five units', () => {
    expect(contributionHeight(1)).toBeGreaterThan(0.35)
    expect(contributionHeight(2)).toBeGreaterThan(contributionHeight(1))
    expect(contributionHeight(20)).toBeGreaterThan(contributionHeight(2))
    expect(contributionHeight(50)).toBeCloseTo(5)
    expect(contributionHeight(100000)).toBeCloseTo(5)
  })
  it('centers 30 plots and keeps real counts for selection', () => {
    const days: ContributionDay[] = Array.from({ length: 30 }, (_, i) => ({ date: String(i), count: i === 29 ? 999 : 0, level: i === 29 ? 'FOURTH_QUARTILE' : 'NONE' }))
    const buildings = mapContributions(days)
    expect(buildings[0]?.position[0]).toBeCloseTo(-3.5)
    expect(buildings[0]?.position[2]).toBeCloseTo(-2.8)
    expect(buildings[29]?.position[0]).toBeCloseTo(3.5)
    expect(buildings[29]?.position[2]).toBeCloseTo(2.8)
    expect(buildings[29]?.count).toBe(999)
    expect(buildings[29]?.height).toBeCloseTo(5)
    expect(buildings[0]?.color).not.toBe(buildings[29]?.color)
  })
})
