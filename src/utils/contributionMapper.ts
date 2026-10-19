import type { ContributionDay } from '../../shared/contributions'
import type { CityBuilding } from '../types/city'
import { cityConfig } from '../config/city'
import { contributionLevels } from '../../shared/contributions'

export function contributionHeight(count: number, config = cityConfig): number {
  if (count <= 0) return config.foundationHeight
  const ratio = Math.log1p(Math.min(count, config.saturationCount)) / Math.log1p(config.saturationCount)
  return config.minHeight + (config.maxHeight - config.minHeight) * ratio
}

export function mapContributions(days: ContributionDay[], config = cityConfig): CityBuilding[] {
  const rows = Math.ceil(days.length / config.columns)
  const profiles = ['tower', 'office', 'stepped'] as const
  return days.map((day, i) => {
    const height = contributionHeight(day.count, config)
    const seed = Array.from(day.date).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
    const variation = (Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) ^ seed) >>> 0
    const profile = day.count === 0 ? 'forest' : profiles[variation % profiles.length]!
    const dimensions = profile === 'forest' ? { width: 1, depth: 1 } : config.architecture.profiles[profile]
    const size = profile === 'forest' ? 1 : 0.94 + ((variation >>> 8) % 7) * 0.01
    const footprint = Math.min(config.footprint, config.streets.plotWidth - 0.12)
    const rotated = profile !== 'forest' && (variation >>> 4 & 1) === 1
    const width = footprint * size * (rotated ? dimensions.depth : dimensions.width)
    const depth = footprint * size * (rotated ? dimensions.width : dimensions.depth)
    return {
      ...day, height, width, depth, profile, seed,
      position: [(i % config.columns - (config.columns - 1) / 2) * config.spacing, height / 2, (Math.floor(i / config.columns) - (rows - 1) / 2) * config.spacing],
      color: config.palette[contributionLevels.indexOf(day.level)] ?? config.palette[0]!,
    }
  })
}
