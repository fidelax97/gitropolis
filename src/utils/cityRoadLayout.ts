import { cityConfig } from '../config/city'

export function getCityRoadLayout(rowCount: number) {
  const { columns, spacing, footprint, streets, cars } = cityConfig
  const rows = Math.max(1, rowCount)
  const roadWidth = spacing - streets.plotWidth
  const halfRoad = roadWidth / 2
  const laneOffset = roadWidth / 4
  const stopOffset = halfRoad + streets.walkingInset + streets.crossingDepth / 2 + 0.06 + cars.length / 2 + 0.02
  return {
    rows, roadWidth, halfRoad, laneOffset, stopOffset,
    width: (columns - 1) * spacing + footprint + streets.margin * 2,
    depth: (rows - 1) * spacing + footprint + streets.margin * 2,
  }
}
