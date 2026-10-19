import { cityConfig } from '../config/city'
import { getCityRoadLayout } from './cityRoadLayout'

interface Point { x: number; z: number }
export interface CarPose extends Point { yaw: number }
export interface CarRouteLeg {
  kind: 'cruise' | 'junction'
  start: Point
  direction: Point
  yaw: number
  length: number
  edge: string
  junction?: string
  incomingEdge?: string
  axis: 'x' | 'z'
  turn?: { lead: number; radius: number; sign: number; center: Point; radial: Point; outgoing: Point }
}
export interface CarRoute { legs: CarRouteLeg[] }

function edgeKey(from: Point, to: Point) { return `${from.x},${from.z}>${to.x},${to.z}` }
function direction(from: Point, to: Point): Point { return { x: Math.sign(to.x - from.x), z: Math.sign(to.z - from.z) } }

function expandCorners(corners: Point[]): Point[] {
  const nodes: Point[] = []
  for (const [index, from] of corners.entries()) {
    const to = corners[(index + 1) % corners.length]!
    const step = direction(from, to)
    const length = Math.abs(to.x - from.x) + Math.abs(to.z - from.z)
    for (let distance = 0; distance < length; distance++) nodes.push({ x: from.x + step.x * distance, z: from.z + step.z * distance })
  }
  return nodes
}

function buildRoute(nodes: Point[], rows: number): CarRoute {
  const { columns, spacing } = cityConfig
  const { laneOffset, halfRoad, stopOffset } = getCityRoadLayout(rows)
  const legs: CarRouteLeg[] = []
  for (const [index, node] of nodes.entries()) {
    const previous = nodes[(index + nodes.length - 1) % nodes.length]!
    const next = nodes[(index + 1) % nodes.length]!
    const incoming = direction(previous, node)
    const outgoing = direction(node, next)
    const junction = { x: (node.x - columns / 2) * spacing, z: (node.z - rows / 2) * spacing }
    const start = { x: junction.x - incoming.x * stopOffset + incoming.z * laneOffset, z: junction.z - incoming.z * stopOffset - incoming.x * laneOffset }
    const end = { x: junction.x + outgoing.x * stopOffset + outgoing.z * laneOffset, z: junction.z + outgoing.z * stopOffset - outgoing.x * laneOffset }
    const sign = incoming.x * outgoing.z - incoming.z * outgoing.x
    const lead = stopOffset - halfRoad
    const radius = halfRoad + sign * laneOffset
    const turnStart = { x: start.x + incoming.x * lead, z: start.z + incoming.z * lead }
    const turn = sign === 0 ? undefined : {
      lead, radius, sign,
      center: { x: turnStart.x + outgoing.x * radius, z: turnStart.z + outgoing.z * radius },
      radial: { x: -outgoing.x * radius, z: -outgoing.z * radius },
      outgoing,
    }
    legs.push({
      kind: 'junction', start, direction: incoming, yaw: Math.atan2(incoming.x, incoming.z),
      length: turn ? lead * 2 + radius * Math.PI / 2 : stopOffset * 2,
      edge: edgeKey(node, next), incomingEdge: edgeKey(previous, node), junction: `${node.x},${node.z}`,
      axis: incoming.x === 0 ? 'z' : 'x', turn,
    })
    legs.push({
      kind: 'cruise', start: end, direction: outgoing, yaw: Math.atan2(outgoing.x, outgoing.z),
      length: spacing - stopOffset * 2, edge: edgeKey(node, next), axis: outgoing.x === 0 ? 'z' : 'x',
    })
  }
  return { legs }
}

export function createCarRoutes(rowCount: number): CarRoute[] {
  const { columns } = cityConfig
  const rows = Math.max(1, rowCount)
  const routes: CarRoute[] = []
  const base: Point[] = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 2 }, { x: 0, z: 2 }]
  for (let z = 0; z + 2 <= rows; z += 2) {
    for (let x = 0; x + 2 <= columns; x += 2) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const rotation = (routes.length + attempt) % 4
        const corners = base.map(point => {
          let local = point
          for (let turn = 0; turn < rotation; turn++) local = { x: 2 - local.z, z: local.x }
          return { x: x + local.x, z: z + local.z }
        })
        const nodes = expandCorners(corners)
        if (nodes.some(node => (node.x === 0 || node.x === columns) && (node.z === 0 || node.z === rows))) continue
        routes.push(buildRoute(nodes, rows))
        break
      }
    }
  }
  return routes
}

export function sampleCarRoute(leg: CarRouteLeg, distance: number): CarPose {
  const turn = leg.turn
  if (!turn || distance <= turn.lead) return { x: leg.start.x + leg.direction.x * distance, z: leg.start.z + leg.direction.z * distance, yaw: leg.yaw }
  const arcLength = turn.radius * Math.PI / 2
  const angle = -turn.sign * Math.min(distance - turn.lead, arcLength) / turn.radius
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const exitDistance = Math.max(0, distance - turn.lead - arcLength)
  return {
    x: turn.center.x + cosine * turn.radial.x + sine * turn.radial.z + turn.outgoing.x * exitDistance,
    z: turn.center.z - sine * turn.radial.x + cosine * turn.radial.z + turn.outgoing.z * exitDistance,
    yaw: leg.yaw + angle,
  }
}
