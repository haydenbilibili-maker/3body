import { describe, expect, it, vi, afterEach } from 'vitest'
import { seedCivilizations, tickUniverse } from './zeroDarkForest'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('seedCivilizations', () => {
  it('生成指定数量、全部存活、坐标在星图范围内的文明', () => {
    const agents = seedCivilizations(12)
    expect(agents).toHaveLength(12)
    expect(new Set(agents.map((a) => a.id)).size).toBe(12)
    for (const a of agents) {
      expect(a.alive).toBe(true)
      expect(a.x).toBeGreaterThanOrEqual(6)
      expect(a.x).toBeLessThanOrEqual(94)
      expect(a.technology_level).toBeGreaterThanOrEqual(0.6)
      expect(a.technology_level).toBeLessThanOrEqual(1.8)
    }
  })

  it('超过代号表长度时使用编号代号', () => {
    const agents = seedCivilizations(14)
    expect(agents[13].codename).toBe('CIV-14')
  })
})

describe('tickUniverse', () => {
  it('不修改传入的数组（返回新对象）', () => {
    const agents = seedCivilizations(6)
    const snapshot = JSON.stringify(agents)
    tickUniverse(agents, 100)
    expect(JSON.stringify(agents)).toBe(snapshot)
  })

  it('死亡不可逆，墓志铭只记录本回合新死亡的文明', () => {
    let agents = seedCivilizations(10)
    const dead = new Set<string>()
    for (let epoch = 100; epoch <= 3000; epoch += 100) {
      const ret = tickUniverse(agents, epoch)
      for (const e of ret.epitaphs) {
        expect(dead.has(e.victim)).toBe(false)
        expect(e.epoch).toBe(epoch)
        dead.add(e.victim)
      }
      for (const a of ret.agents) {
        if (dead.has(a.codename)) expect(a.alive).toBe(false)
      }
      agents = ret.agents
    }
    expect(agents.filter((a) => !a.alive).length).toBe(dead.size)
  })

  it('两个文明紧挨且必然开火时，恰好一方被清除', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // 移动量取下界、掷骰必中
    const agents = seedCivilizations(2).map((a, i) => ({
      ...a,
      x: 50 + i,
      y: 50,
      paranoia_index: 0.9,
      concealment_skill: 0.2,
    }))
    const ret = tickUniverse(agents, 1)
    expect(ret.epitaphs).toHaveLength(1)
    expect(ret.agents.filter((a) => a.alive)).toHaveLength(1)
  })

  it('坐标始终在 [2, 98] 内，技术等级不超过 2.2', () => {
    let agents = seedCivilizations(8).map((a) => ({ ...a, paranoia_index: 0 }))
    for (let i = 0; i < 200; i += 1) agents = tickUniverse(agents, i).agents
    for (const a of agents) {
      expect(a.x).toBeGreaterThanOrEqual(2)
      expect(a.x).toBeLessThanOrEqual(98)
      expect(a.technology_level).toBeLessThanOrEqual(2.2)
    }
  })
})
