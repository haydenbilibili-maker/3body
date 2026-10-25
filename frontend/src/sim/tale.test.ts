import { describe, expect, it } from 'vitest'
import { TALES, confirmedCount, judge, segments } from './tale'

describe('tale', () => {
  it('each tale has exactly one confirmed reading and every image appears in its text', () => {
    for (const t of TALES) {
      const trues = t.images.flatMap((i) => i.readings.filter((r) => r.true))
      expect(trues).toHaveLength(1)
      const imgs = segments(t).filter((s) => 'image' in s)
      expect(imgs).toHaveLength(t.images.length)
    }
  })

  it('the canon readings are all confirmed', () => {
    const report = {
      painter: { image: 'painter', reading: 'flatten' },
      soap: { image: 'soap', reading: 'curvature' },
      umbrella: { image: 'umbrella', reading: 'blackdomain' },
    }
    expect(confirmedCount(report)).toBe(3)
  })

  it('a right image with a wrong reading is not confirmed', () => {
    const v = judge({ painter: { image: 'painter', reading: 'censor' } })
    expect(v[0].confirmed).toBe(false)
    expect(v[0].reading?.by).toBe('情报分析员')
    expect(v[1].pick).toBeNull()
  })

  it('segments keep the text around images in order', () => {
    const s = segments(TALES[1])
    const text = s.map((x) => ('text' in x ? x.text : `[${x.image.word}]`)).join('')
    expect(text).toContain('[肥皂]')
    expect(text.startsWith('公主的船')).toBe(true)
  })
})
