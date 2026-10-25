import { describe, expect, it } from 'vitest'
import { record, sophonLine, stareSeconds, tally } from './blind'

describe('blind zone', () => {
  it('sophons see what is said or written', () => {
    expect(record(1, '去木星', 'say', 'human').seen).toBe(true)
    expect(record(2, '去木星', 'write', 'human').seen).toBe(true)
  })
  it('a human thought is invisible — and cannot be shared', () => {
    const t = record(3, '真正的计划', 'think', 'human')
    expect(t.seen).toBe(false)
    expect(t.shared).toBe(false)
    expect(sophonLine(t, 'human')).not.toContain('真正的计划')
    expect(sophonLine(t, 'human')).toContain('墙')
  })
  it('a trisolaran mind has no blind zone', () => {
    const t = record(4, '撤退', 'think', 'trisolaran')
    expect(t.seen).toBe(true)
    expect(sophonLine(t, 'trisolaran')).toContain('撤退')
  })
  it('longer thoughts mean longer staring', () => {
    expect(stareSeconds('一'.repeat(40))).toBeGreaterThan(stareSeconds('一'))
  })
  it('tallies', () => {
    const ts = [record(1, 'a', 'say', 'human'), record(2, 'b', 'think', 'human')]
    expect(tally(ts)).toEqual({ seen: 1, hidden: 1, shared: 1 })
  })
})
