import { describe, expect, it } from 'vitest'
import { followUpsFor, visitorFor } from './figureMemory'

describe('figure memory', () => {
  it('a figure only hears about related rooms', () => {
    const answers = {
      '/sector-sword': { text: '威慑度 62%；威慑还在' },
      '/sector-r': { text: '收到「不要回答」之后，保持了沉默' },
    }
    expect(visitorFor('罗辑', answers)).toContain('执剑人')
    expect(visitorFor('罗辑', answers)).not.toContain('不要回答')
    expect(visitorFor('叶文洁', answers)).toContain('保持了沉默')
    expect(visitorFor('丁仪', answers)).toBeUndefined()
  })

  it('follow-ups react to the last line and skip what was asked', () => {
    expect(followUpsFor('（他沉默了很久。）也许吧。', new Set())).toContain('你在怕什么？')
    expect(followUpsFor('你呢？', new Set())[0]).toBe('如果换作是你呢？')
    expect(followUpsFor('嗯。', new Set(['为什么？']))).not.toContain('为什么？')
  })
})
