import { Color, InstancedMesh, Object3D, type BufferGeometry, type Group, type Material } from 'three'

export interface CityPart {
  position: [number, number, number]
  scale: [number, number, number]
  color?: string
}

export function instanceCityParts(parts: CityPart[], geometry: BufferGeometry, material: Material): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, parts.length)
  const transform = new Object3D()
  const color = new Color()
  for (const [index, part] of parts.entries()) {
    transform.position.set(...part.position)
    transform.scale.set(...part.scale)
    transform.updateMatrix()
    mesh.setMatrixAt(index, transform.matrix)
    if (part.color) mesh.setColorAt(index, color.set(part.color))
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

export function disposeCityInstances(group: Group) {
  group.traverse(object => {
    if (object instanceof InstancedMesh) object.dispose()
  })
  group.clear()
}
