import { describe, expect, it } from 'vitest'
import { FORKS, notesFor, readWorldline, summarize } from './worldline'

const a = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { text: v }]))

describe('worldline', () => {
  it('reads the choice from the text each room records', () => {
    const s = readWorldline(
      a({
        '/sector-r': '收到「不要回答」之后，保持了沉默',
        '/sector-guzheng': '执行了古筝计划，丝距 0.50 米；拿到了三体信息',
        '/sector-ns': '下达了「前进四」，带着自然选择号逃离太阳系',
        '/sector-sword': '威慑度 62%；威慑还在',
        '/sector-u': '留在了 647 号小宇宙里',
        '/sector-x': '没有归还质量；宇宙没有重启',
      }),
    )
    const m = Object.fromEntries(s.map((x) => [x.fork.id, x.mine]))
    expect(m).toEqual({ reply: 'silent', guzheng: 'executed', staircase: null, ns: 'fled', sword: 'held', mini: 'stayed', return: 'kept' })
    expect(summarize(s)).toMatchObject({ visited: 6, diverged: 4 })
    expect(summarize(s).first?.fork.id).toBe('reply')
  })

  it('a canon run has no divergence and no notes', () => {
    const s = readWorldline(
      a({ '/sector-r': '收到「不要回答」之后，回答了三体世界', '/sector-sword': '威慑度 10%；你没有按' }),
    )
    expect(summarize(s).diverged).toBe(0)
    expect(notesFor('/sector-j', 'bunker', s)).toBeNull()
  })

  it('the earliest divergence decides the note', () => {
    const s = readWorldline(a({ '/sector-r': '收到「不要回答」之后，保持了沉默', '/sector-sword': '威慑度 80%；威慑还在' }))
    expect(notesFor('/sector-j', 'bunker', s)).toContain('红岸保持了沉默')
    expect(notesFor('/sector-r', 'common', s)).toBeNull()
  })

  it('later forks only touch the rooms they change', () => {
    const s = readWorldline(a({ '/sector-sword': '威慑度 80%；威慑还在', '/sector-ns': '照常试航，回到了舰队' }))
    expect(notesFor('/sector-j', 'bunker', s)).toContain('威慑还在')
    expect(notesFor('/sector-human', 'galaxy', s)).toContain('自然选择号回到了编队')
    expect(notesFor('/sector-a', 'crisis', s)).toBeNull()
  })

  it('every fork offers its canon option', () => {
    for (const f of FORKS) expect(f.options[f.canon]).toBeDefined()
  })
})
