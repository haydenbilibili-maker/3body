import { describe, expect, it } from 'vitest'
import { LEVELS, allBits, applyGate, evaluate, solutions, solved, truthTable } from './humanComputer'

describe('human computer', () => {
  it('implements the gates', () => {
    expect(applyGate('NOT', 1)).toBe(0)
    expect(applyGate('AND', 1, 1)).toBe(1)
    expect(applyGate('OR', 0, 1)).toBe(1)
    expect(applyGate('XOR', 1, 1)).toBe(0)
  })

  it('enumerates every input combination', () => {
    expect(allBits(3)).toHaveLength(8)
    expect(allBits(2)[1]).toEqual([0, 1])
  })

  LEVELS.forEach((level) => {
    it(`${level.id} has at least one solution and is not solved by default`, () => {
      const sols = solutions(level)
      expect(sols.length).toBeGreaterThan(0)
      expect(solved(level, {})).toBe(false)
      expect(sols.length).toBeLessThan(level.nodes.reduce((n, x) => n * x.choices.length, 1))
    })
    it(`${level.id} wires only to earlier nodes or inputs`, () => {
      const known = new Set(level.inputs)
      for (const n of level.nodes) {
        for (const i of n.inputs) expect(known.has(i)).toBe(true)
        known.add(n.id)
      }
    })
  })

  it('leaves unassigned formations empty', () => {
    const v = evaluate(LEVELS[1], { n1: 'OR' }, [1, 0])
    expect(v.n1).toBe(1)
    expect(v.n4).toBe(null)
  })

  it('reports which rows fail', () => {
    const rows = truthTable(LEVELS[0], { n1: 'PASS' })
    expect(rows.every((r) => !r.ok)).toBe(true)
  })
})
