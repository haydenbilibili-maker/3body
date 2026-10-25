import { describe, expect, it } from 'vitest'
import { DEBATES } from './figureDebates'
import { sceneById } from './figureScenes'

describe('figure debates', () => {
  it('every debate seats two figures in real scenes and has four offline lines', () => {
    for (const d of DEBATES) {
      expect(sceneById(d.a.scene)?.figure).toBe(d.a.figure)
      expect(sceneById(d.b.scene)?.figure).toBe(d.b.figure)
      expect(d.offline).toHaveLength(4)
      expect(d.topic.endsWith('？')).toBe(true)
    }
  })
})
