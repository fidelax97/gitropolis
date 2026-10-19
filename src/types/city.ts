import type { ContributionDay } from '../../shared/contributions'

export type BuildingProfile = 'tower' | 'office' | 'stepped' | 'forest'

export interface CityBuilding extends ContributionDay {
  height: number
  width: number
  depth: number
  profile: BuildingProfile
  seed: number
  position: [number, number, number]
  color: string
}
