import { describe, expect, it } from 'vitest'
import { CITIES, cityByName, gravityAt, rpmFor } from './spaceCity'

describe('space cities', () => {
  it('a 900 m wheel needs about one turn a minute for 1 g', () => {
    const rpm = rpmFor(900)
    expect(rpm).toBeGreaterThan(0.99)
    expect(rpm).toBeLessThan(1.0)
  })

  it('bigger cities turn slower', () => {
    expect(rpmFor(3200)).toBeLessThan(rpmFor(900))
  })

  it('gravity falls off toward the axis', () => {
    expect(gravityAt(900, 900)).toBe(1)
    expect(gravityAt(900, 450)).toBe(0.5)
  })

  it('every city in the bunker orrery has an atlas entry', () => {
    for (const n of ['亚洲一号', '北美一号', '欧洲三号', '太平洋一号', '天王星城', '海王星城']) {
      expect(cityByName(n)).toBeTruthy()
    }
    expect(new Set(CITIES.map((c) => c.shape)).size).toBe(6)
  })
})
