import { describe, expect, it } from 'vitest'
import { BINS, DOMAIN_COVERAGE, MAX_SPEED, STAR, contraction, coverage, createFlight, speedOf, step } from './curvature'

describe('curvature', () => {
  it('never exceeds the speed limit', () => {
    let s = createFlight()
    for (let i = 0; i < 200; i++) s = step(s, { turn: 0.2, thrust: 1 })
    expect(speedOf(s.ship)).toBeLessThanOrEqual(MAX_SPEED + 1e-9)
  })

  it('contracts the hull as speed rises', () => {
    const slow = contraction({ x: 0, y: 0, vx: 0.1, vy: 0, angle: 0 })
    const fast = contraction({ x: 0, y: 0, vx: MAX_SPEED, vy: 0, angle: 0 })
    expect(fast).toBeLessThan(slow)
  })

  it('a full ring of trail around the star forms a black domain', () => {
    const trail = Array.from({ length: BINS * 2 }, (_, i) => {
      const a = (i / (BINS * 2)) * Math.PI * 2
      return { x: STAR.x + Math.cos(a) * 120, y: STAR.y + Math.sin(a) * 120, age: 0 }
    })
    expect(coverage(trail)).toBeGreaterThanOrEqual(DOMAIN_COVERAGE)
  })

  it('circling the star ends in the black domain', () => {
    let s = createFlight()
    // 绕恒星飞：保持航向与半径方向垂直
    for (let i = 0; i < 4000 && !s.ending; i++) {
      const dx = s.ship.x - STAR.x
      const dy = s.ship.y - STAR.y
      const r = Math.hypot(dx, dy)
      const tangent = Math.atan2(dy, dx) + Math.PI / 2 + (r - 120) * 0.02
      let diff = tangent - s.ship.angle
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      s = step(s, { turn: Math.max(-1, Math.min(1, diff * 4)), thrust: 0.25 })
    }
    expect(s.ending).toBe('domain')
  })

  it('flying straight out escapes', () => {
    let s = createFlight()
    for (let i = 0; i < 2000 && !s.ending; i++) s = step(s, { turn: 0, thrust: 1 })
    expect(s.ending).toBe('escape')
  })
})
