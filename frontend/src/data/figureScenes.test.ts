import { describe, expect, it } from 'vitest'
import { FIGURE_SCENES, sceneById, scenesOf, splitStage, touchedKeys } from './figureScenes'
import { CORE_FIGURES_WITH_DIALOGUE } from './figureDialogues'

describe('figure scenes', () => {
  it('every core figure has at least one scene, ids are unique', () => {
    for (const f of CORE_FIGURES_WITH_DIALOGUE) expect(scenesOf(f).length).toBeGreaterThan(0)
    expect(new Set(FIGURE_SCENES.map((s) => s.id)).size).toBe(FIGURE_SCENES.length)
  })

  it('every scene opens with a line, offers questions and three keys', () => {
    for (const s of FIGURE_SCENES) {
      expect(s.opening.length).toBeGreaterThan(4)
      expect(s.questions.length).toBeGreaterThanOrEqual(3)
      expect(s.keys).toHaveLength(3)
      expect(s.offline.length).toBeGreaterThan(0)
    }
  })

  it('splits stage directions from spoken lines', () => {
    const p = splitStage('（他点了一支烟。）你也是来看杨冬的？（他没有回头。）')
    expect(p.map((x) => x.kind)).toEqual(['stage', 'line', 'stage'])
    expect(p[0].text).toBe('他点了一支烟。')
  })

  it('touching a topic loosens one notch of the guard', () => {
    const s = sceneById('luoji-grave')!
    expect(touchedKeys(s, ['她跟你说了什么？']).size).toBe(0)
    expect([...touchedKeys(s, ['那两句话是什么？', '文明之间能互相信任吗？'])].sort()).toEqual(['公理', '猜疑'].sort())
  })
})
