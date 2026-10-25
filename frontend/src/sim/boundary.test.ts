import { describe, expect, it } from 'vitest'
import { THANKSGIVING, endPoint, holes, laplace, shoot } from './boundary'

describe('scientific boundary', () => {
  it('repeats the same billiard shot exactly', () => {
    expect(endPoint(shoot(20, 60))).toEqual(endPoint(shoot(20, 60)))
  })

  it('gives different results each time under sophon interference', () => {
    const a = endPoint(shoot(20, 60, 0.6, 1))
    const b = endPoint(shoot(20, 60, 0.6, 2))
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1)
  })

  it('grows the turkey scientist confidence toward certainty', () => {
    expect(laplace(0)).toBe(0.5)
    expect(laplace(THANKSGIVING - 1)).toBeGreaterThan(0.99)
  })

  it('lays holes on a grid until the shooter changes his mind', () => {
    const h = holes(12, 9)
    expect(h[1].x - h[0].x).toBe(20)
    expect(h.slice(9).some((p) => (p.x - 20) % 20 !== 0)).toBe(true)
  })
})
