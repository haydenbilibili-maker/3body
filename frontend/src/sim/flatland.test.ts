import { describe, expect, it } from 'vitest'
import { FLAT_LEVELS, castRetina, drop, lift, move, parseLevel, stars, visibleCells, type FlatState } from './flatland'

const stateKey = (s: FlatState) => `${s.pos.r},${s.pos.c},${s.lifted},${s.fragment},${s.items.join('|')}`

/** 按碎片消耗分桶搜索，返回通关所需的最少碎片；无解返回 -1 */
function minFragment(levelIndex: number): number {
  const level = FLAT_LEVELS[levelIndex]
  const start = parseLevel(level)
  const seen = new Set([stateKey(start)])
  const buckets: FlatState[][] = [[start]]
  for (let cost = 0; cost <= level.fragment; cost += 1) {
    const q = buckets[cost] ?? []
    while (q.length) {
      const s = q.pop()!
      if (s.status === 'won') return cost
      for (const n of [move(s, 1, 0), move(s, -1, 0), move(s, 0, 1), move(s, 0, -1), lift(s), drop(s)]) {
        if (n.status === 'lost') continue
        const k = stateKey(n)
        if (seen.has(k)) continue
        seen.add(k)
        ;(buckets[level.fragment - n.fragment] ??= []).push(n)
      }
    }
  }
  return -1
}

describe('flatland levels', () => {
  FLAT_LEVELS.forEach((level, i) => {
    it(`${level.id} is solvable and par is the true minimum`, () => {
      expect(minFragment(i)).toBe(level.par)
      expect(level.fragment).toBeGreaterThanOrEqual(level.par)
    })
    it(`${level.id} cannot be solved without leaving the plane`, () => {
      // 只在平面上走：碎片永不消耗，搜索应当无解
      const start = parseLevel(level)
      const seen = new Set([stateKey(start)])
      const q = [start]
      let won = false
      while (q.length && !won) {
        const s = q.shift()!
        for (const n of [move(s, 1, 0), move(s, -1, 0), move(s, 0, 1), move(s, 0, -1)]) {
          if (n.status === 'won') won = true
          const k = stateKey(n)
          if (!seen.has(k)) {
            seen.add(k)
            q.push(n)
          }
        }
      }
      expect(won).toBe(false)
    })
  })
})

describe('flatland rules', () => {
  const level = FLAT_LEVELS[0]

  it('walls block movement on the plane', () => {
    let s = parseLevel(level)
    s = move(s, -1, 0) // 起点上方是墙
    expect(s.pos).toEqual({ r: 1, c: 1 })
    expect(s.moves).toBe(0)
  })

  it('lifting reveals every cell and costs fragment', () => {
    let s = parseLevel(level)
    expect(visibleCells(s)).not.toContain('4,4') // 密室内部在平面上不可见
    s = lift(s)
    expect(s.lifted).toBe(true)
    expect(s.fragment).toBe(level.fragment - 1)
    expect(visibleCells(s)).toContain('4,4')
  })

  it('running out of fragment over a wall loses the level', () => {
    let s = { ...parseLevel(level), fragment: 2 }
    s = move(s, 1, 0) // (2,1)
    s = move(s, 0, 1) // (2,2)
    s = lift(s) // fragment 1
    s = move(s, 1, 0) // (3,2) 是地面 → 安全落地
    expect(s.status).toBe('playing')
    expect(s.lifted).toBe(false)
    let t = { ...parseLevel(level), fragment: 2, pos: { r: 2, c: 4 } }
    t = lift(t) // 1
    t = move(t, 1, 0) // (3,4) 墙，碎片 0
    expect(t.status).toBe('lost')
  })

  it('cannot drop onto a wall', () => {
    let s = { ...parseLevel(level), pos: { r: 2, c: 4 } }
    s = lift(s)
    s = move(s, 1, 0)
    const d = drop(s)
    expect(d.lifted).toBe(true)
  })

  it('retina returns one sample per ray', () => {
    const s = parseLevel(level)
    const r = castRetina(s, 32)
    expect(r).toHaveLength(32)
    expect(r.some((x) => x.kind === 'wall')).toBe(true)
  })

  it('awards three stars at par', () => {
    const s = { ...parseLevel(level), status: 'won' as const, fragment: level.fragment - level.par }
    expect(stars(level, s)).toBe(3)
    expect(stars(level, { ...s, fragment: 0 })).toBe(1)
  })
})
